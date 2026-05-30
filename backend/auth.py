"""
OIDC Authentication Middleware for FastAPI
Validates JWT tokens from SAP IAS (Identity Authentication Service)
"""
import os
import time
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from jose.jwk import construct
import requests

logger = logging.getLogger(__name__)


# JWKS cache time-to-live (seconds). Keys are refetched after this window so
# IdP key rotation is picked up without a process restart.
JWKS_CACHE_TTL = 3600


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


class OIDCConfig:
    """OIDC Configuration from environment variables"""
    def __init__(self):
        # No real tenant baked in as a default — must be provided via env.
        self.issuer = (os.getenv("OIDC_ISSUER") or "").rstrip("/")
        self.client_id = os.getenv("OIDC_CLIENT_ID")
        self.audience = os.getenv("OIDC_AUDIENCE", self.client_id)
        # Explicit opt-in for the unauthenticated local-dev bypass. Never honoured
        # in production (see middleware). Without this flag, missing OIDC config
        # fails closed instead of silently disabling auth.
        self.dev_bypass = _env_flag("AUTH_DEV_BYPASS")

        if not self.client_id:
            logger.warning("OIDC_CLIENT_ID not set - authentication is not configured")

        # Discover OIDC endpoints
        self.well_known_url = f"{self.issuer}/.well-known/openid-configuration" if self.issuer else None
        self.jwks_uri = None
        self.jwks_cache = None
        self.jwks_cache_ts = 0.0
        if self.issuer:
            self._discover_endpoints()

    def _discover_endpoints(self):
        """Fetch OIDC discovery document"""
        try:
            response = requests.get(self.well_known_url, timeout=5)
            response.raise_for_status()
            config = response.json()
            self.jwks_uri = config.get("jwks_uri")
            logger.info(f"OIDC discovery successful: {self.issuer}")
        except Exception as e:
            logger.error(f"Failed to fetch OIDC configuration: {e}")
            # Set default JWKS URI based on common SAP IAS pattern
            self.jwks_uri = f"{self.issuer}/oauth2/certs"

    def get_jwks(self, force: bool = False) -> Dict[str, Any]:
        """Fetch the JSON Web Key Set, cached with a TTL.

        Set ``force=True`` to bypass the cache (e.g. when a token references a
        ``kid`` not present in the cached keys, indicating IdP key rotation).
        """
        fresh = (time.time() - self.jwks_cache_ts) < JWKS_CACHE_TTL
        if self.jwks_cache and fresh and not force:
            return self.jwks_cache

        if not self.jwks_uri:
            logger.error("JWKS URI is not configured")
            return self.jwks_cache or {"keys": []}

        try:
            response = requests.get(self.jwks_uri, timeout=5)
            response.raise_for_status()
            self.jwks_cache = response.json()
            self.jwks_cache_ts = time.time()
            logger.info(f"JWKS fetched successfully from {self.jwks_uri}")
            return self.jwks_cache
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            # Keep serving the previous cache (if any) rather than locking out
            # all tokens on a transient network blip.
            return self.jwks_cache or {"keys": []}


class OIDCMiddleware:
    """
    OIDC Middleware for FastAPI
    Validates JWT tokens and injects user info into request state
    """

    # Public paths that don't require authentication
    PUBLIC_PATHS = [
        "/health",
        "/health/ready",
        "/health/live",
        "/metrics",
        "/docs",
        "/openapi.json",
        "/redoc",
    ]

    def __init__(self, app, config: Optional[OIDCConfig] = None):
        self.app = app
        self.config = config or OIDCConfig()

    async def __call__(self, request: Request, call_next):
        """Process request and validate JWT if required"""
        # Skip authentication for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip authentication for public paths
        if any(request.url.path.startswith(path) for path in self.PUBLIC_PATHS):
            return await call_next(request)

        # Authentication not configured (no client id).
        if not self.config.client_id:
            # Production must never run without auth.
            if os.getenv("ENVIRONMENT") == "production":
                logger.error("OIDC not configured in production environment")
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={"detail": "Authentication service not configured"},
                )
            # Fail closed unless the dev bypass is explicitly opted into.
            if not self.config.dev_bypass:
                logger.error(
                    "OIDC not configured and AUTH_DEV_BYPASS not set - refusing request. "
                    "Set OIDC_CLIENT_ID (real auth) or AUTH_DEV_BYPASS=1 (local dev only)."
                )
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={"detail": "Authentication service not configured"},
                )
            logger.warning("AUTH_DEV_BYPASS enabled - bypassing authentication (dev only)")
            request.state.user = {"sub": "dev-user", "email": "dev@example.com"}
            request.state.auth_dev_bypass = True
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing Authorization header"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid Authorization header format"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth_header.split(" ", 1)[1]

        # Validate token
        try:
            user_info = self._validate_token(token)
            request.state.user = user_info
            request.state.auth_dev_bypass = False
            logger.debug(f"Authenticated user: {user_info.get('email', user_info.get('sub'))}")
        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail},
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": f"Token validation failed: {str(e)}"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        return await call_next(request)

    def _validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate JWT token
        Returns decoded token claims if valid
        Raises HTTPException if invalid
        """
        try:
            # Get unverified header to find key ID
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")

            # Log token claims for debugging (DEBUG only — identity metadata).
            if logger.isEnabledFor(logging.DEBUG):
                try:
                    c = jwt.get_unverified_claims(token)
                    logger.debug(
                        "Token claims: iss=%s aud=%s azp=%s exp=%s (expected iss=%s aud=%s)",
                        c.get("iss"), c.get("aud"), c.get("azp"), c.get("exp"),
                        self.config.issuer, self.config.audience,
                    )
                except Exception:
                    pass

            if not kid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token missing key ID (kid)"
                )

            # Find the matching key; if not found, refetch JWKS once in case the
            # IdP rotated keys, then look again.
            def _find_key(jwks):
                for jwk_key in jwks.get("keys", []):
                    if jwk_key.get("kid") == kid:
                        return construct(jwk_key)
                return None

            key = _find_key(self.config.get_jwks())
            if not key:
                key = _find_key(self.config.get_jwks(force=True))

            if not key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Public key not found for kid: {kid}"
                )

            # Decode and validate token signature/time-based claims
            decode_options = {
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iat": True,
                "verify_aud": False,  # manual audience validation below
                "verify_iss": False,  # manual issuer validation below
            }

            decoded = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                options=decode_options,
            )

            # Use time.time() (true UTC epoch). datetime.utcnow().timestamp()
            # is wrong on non-UTC hosts because it treats the naive UTC value
            # as local time.
            current_time = time.time()

            # Check expiration
            exp = decoded.get("exp")
            if exp and current_time > exp:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired"
                )

            # Check not before
            nbf = decoded.get("nbf")
            if nbf and current_time < nbf:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token not yet valid"
                )

            # Issuer validation (mandatory: reject tokens with no/invalid issuer).
            issuer = decoded.get("iss")
            if not self.config.issuer:
                # Without a configured issuer we cannot validate — fail closed.
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Issuer not configured"
                )
            if issuer != self.config.issuer:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token issuer"
                )

            # Audience / azp validation (mandatory). SAP IAS uses azp for client_id.
            allowed_audiences = [a for a in {self.config.audience, self.config.client_id} if a]
            if not allowed_audiences:
                # No audience to check against — fail closed rather than accept all.
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Audience not configured"
                )

            aud_claim = decoded.get("aud")
            azp_claim = decoded.get("azp")

            audience_ok = False
            if isinstance(aud_claim, list):
                audience_ok = any(aud in aud_claim for aud in allowed_audiences)
            elif isinstance(aud_claim, str):
                audience_ok = aud_claim in allowed_audiences

            # Fallback: SAP IAS often places client_id in azp
            if not audience_ok and azp_claim:
                audience_ok = azp_claim in allowed_audiences

            if not audience_ok:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token audience"
                )

            return decoded

        except JWTError as e:
            logger.error(f"JWT validation error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error during token validation: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error during authentication"
            )


def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user from request state
    Usage: user = Depends(get_current_user)
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return request.state.user
