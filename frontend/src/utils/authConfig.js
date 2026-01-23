/**
 * OIDC Authentication Configuration
 * Configuration for SAP IAS (Identity Authentication Service)
 */

const VITE_OIDC_AUTHORITY = import.meta.env.VITE_OIDC_AUTHORITY || 'https://asojzafbi.accounts.ondemand.com';
const VITE_OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID || '';
const VITE_OIDC_REDIRECT_URI = import.meta.env.VITE_OIDC_REDIRECT_URI || `${window.location.origin}/callback`;
const VITE_OIDC_POST_LOGOUT_REDIRECT_URI = import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || window.location.origin;

export const oidcConfig = {
    authority: VITE_OIDC_AUTHORITY,
    client_id: VITE_OIDC_CLIENT_ID,
    redirect_uri: VITE_OIDC_REDIRECT_URI,
    post_logout_redirect_uri: VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',

    // PKCE settings (more secure than implicit flow)
    automaticSilentRenew: true,
    loadUserInfo: true,

    // UI settings
    popupWindowFeatures: 'location=no,toolbar=no,width=500,height=600,left=100,top=100',

    // Token storage
    userStore: 'session', // Use sessionStorage for better security

    // Silent renew settings
    silent_redirect_uri: `${window.location.origin}/silent-renew.html`,
    silentRequestTimeoutInSeconds: 30,

    // Optional: Add extra query params if needed by SAP IAS
    extraQueryParams: {},

    // Metadata (optional, will be auto-discovered)
    metadata: {
        issuer: VITE_OIDC_AUTHORITY,
        authorization_endpoint: `${VITE_OIDC_AUTHORITY}/oauth2/authorize`,
        token_endpoint: `${VITE_OIDC_AUTHORITY}/oauth2/token`,
        userinfo_endpoint: `${VITE_OIDC_AUTHORITY}/oauth2/userinfo`,
        end_session_endpoint: `${VITE_OIDC_AUTHORITY}/oauth2/logout`,
        jwks_uri: `${VITE_OIDC_AUTHORITY}/oauth2/certs`,
    },
};

/**
 * Check if OIDC is properly configured
 */
export const isOIDCConfigured = () => {
    return Boolean(VITE_OIDC_CLIENT_ID);
};

/**
 * Get user-friendly error messages
 */
export const getAuthErrorMessage = (error) => {
    const errorMessages = {
        'login_required': 'Please log in to continue',
        'consent_required': 'Consent is required to proceed',
        'interaction_required': 'User interaction is required',
        'account_selection_required': 'Please select an account',
        'access_denied': 'Access was denied',
        'invalid_request': 'Invalid authentication request',
        'unauthorized_client': 'Client is not authorized',
        'unsupported_response_type': 'Response type not supported',
        'invalid_scope': 'Invalid scope requested',
        'server_error': 'Authentication server error',
        'temporarily_unavailable': 'Service temporarily unavailable',
    };

    const errorCode = error?.error || error?.message || 'unknown';
    return errorMessages[errorCode] || `Authentication error: ${errorCode}`;
};
