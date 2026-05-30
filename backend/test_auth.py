"""
Security tests for the OIDC middleware:
- JWT validation (signature, expiry, issuer, audience, kid) via a self-signed key
- Fail-closed behaviour when auth is not configured
"""
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth import OIDCConfig, OIDCMiddleware

jwt = pytest.importorskip("jose.jwt")
from jose import jwt  # noqa: E402

ISSUER = "https://issuer.test"
CLIENT_ID = "test-client"
KID = "test-kid"


@pytest.fixture(scope="module")
def keypair():
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    from jose import jwk

    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv_pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    pub_pem = priv.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    pub_jwk = jwk.construct(pub_pem, algorithm="RS256").to_dict()
    pub_jwk["kid"] = KID
    return priv_pem, pub_jwk


@pytest.fixture()
def config(keypair):
    _, pub_jwk = keypair
    cfg = OIDCConfig.__new__(OIDCConfig)  # build without env-based discovery
    cfg.issuer = ISSUER
    cfg.client_id = CLIENT_ID
    cfg.audience = CLIENT_ID
    cfg.dev_bypass = False
    cfg.well_known_url = None
    cfg.jwks_uri = "https://issuer.test/jwks"
    cfg.jwks_cache = {"keys": [pub_jwk]}
    cfg.jwks_cache_ts = time.time()
    return cfg


def _token(priv_pem, *, kid=KID, **overrides):
    now = int(time.time())
    claims = {"iss": ISSUER, "aud": CLIENT_ID, "iat": now, "nbf": now - 10,
              "exp": now + 3600, "sub": "user@test"}
    claims.update(overrides)
    headers = {"kid": kid} if kid else {}
    return jwt.encode(claims, priv_pem, algorithm="RS256", headers=headers)


def _validate(config, token):
    mw = OIDCMiddleware(app=None, config=config)
    return mw._validate_token(token)


class TestTokenValidation:
    def test_valid_token_accepted(self, keypair, config):
        priv_pem, _ = keypair
        decoded = _validate(config, _token(priv_pem))
        assert decoded["sub"] == "user@test"

    def test_expired_token_rejected(self, keypair, config):
        priv_pem, _ = keypair
        with pytest.raises(Exception):
            _validate(config, _token(priv_pem, exp=int(time.time()) - 10))

    def test_wrong_audience_rejected(self, keypair, config):
        priv_pem, _ = keypair
        with pytest.raises(Exception):
            _validate(config, _token(priv_pem, aud="someone-else"))

    def test_wrong_issuer_rejected(self, keypair, config):
        priv_pem, _ = keypair
        with pytest.raises(Exception):
            _validate(config, _token(priv_pem, iss="https://evil.test"))

    def test_missing_issuer_rejected(self, keypair, config):
        priv_pem, _ = keypair
        # iss=None -> claim absent -> mandatory issuer check fails
        with pytest.raises(Exception):
            _validate(config, _token(priv_pem, iss=None))

    def test_azp_fallback_accepted(self, keypair, config):
        """SAP IAS may put the client id in azp instead of aud."""
        priv_pem, _ = keypair
        decoded = _validate(config, _token(priv_pem, aud="frontend", azp=CLIENT_ID))
        assert decoded["sub"] == "user@test"


def _app_with(config, monkeypatch, env="test"):
    monkeypatch.setenv("ENVIRONMENT", env)
    app = FastAPI()
    app.middleware("http")(OIDCMiddleware(app, config))

    @app.get("/protected")
    def protected():
        return {"ok": True}

    return TestClient(app, raise_server_exceptions=False)


def _bare_config(**attrs):
    cfg = OIDCConfig.__new__(OIDCConfig)
    cfg.issuer = ""
    cfg.client_id = None
    cfg.audience = None
    cfg.dev_bypass = False
    cfg.well_known_url = None
    cfg.jwks_uri = None
    cfg.jwks_cache = None
    cfg.jwks_cache_ts = 0.0
    for k, v in attrs.items():
        setattr(cfg, k, v)
    return cfg


class TestFailClosed:
    def test_unconfigured_without_bypass_is_503(self, monkeypatch):
        client = _app_with(_bare_config(), monkeypatch, env="development")
        assert client.get("/protected").status_code == 503

    def test_unconfigured_with_bypass_allows(self, monkeypatch):
        client = _app_with(_bare_config(dev_bypass=True), monkeypatch, env="development")
        assert client.get("/protected").status_code == 200

    def test_production_never_bypasses(self, monkeypatch):
        # Even with the bypass flag, production must fail closed.
        client = _app_with(_bare_config(dev_bypass=True), monkeypatch, env="production")
        assert client.get("/protected").status_code == 503
