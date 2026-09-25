package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/endpoints"
)

// GoogleUser adalah data profil minimal dari Google.
type GoogleUser struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
}

// GoogleProvider membungkus alur OAuth Google (authorization code + PKCE).
// Didefinisikan sebagai interface agar bisa dipalsukan di tes.
type GoogleProvider interface {
	AuthCodeURL(state, verifier, redirectURL string) string
	Exchange(ctx context.Context, code, verifier, redirectURL string) (GoogleUser, error)
}

// UserinfoURL adalah endpoint OpenID Connect userinfo Google.
const UserinfoURL = "https://openidconnect.googleapis.com/v1/userinfo"

type googleOAuth struct {
	clientID, clientSecret string
	httpClient             *http.Client
}

// NewGoogleProvider mengembalikan nil bila kredensial belum diatur.
func NewGoogleProvider(clientID, clientSecret string) GoogleProvider {
	if clientID == "" || clientSecret == "" {
		return nil
	}
	return &googleOAuth{clientID: clientID, clientSecret: clientSecret, httpClient: http.DefaultClient}
}

func (g *googleOAuth) config(redirectURL string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     g.clientID,
		ClientSecret: g.clientSecret,
		Endpoint:     endpoints.Google,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
	}
}

func (g *googleOAuth) AuthCodeURL(state, verifier, redirectURL string) string {
	return g.config(redirectURL).AuthCodeURL(state,
		oauth2.S256ChallengeOption(verifier),
		oauth2.SetAuthURLParam("prompt", "select_account"))
}

func (g *googleOAuth) Exchange(ctx context.Context, code, verifier, redirectURL string) (GoogleUser, error) {
	cfg := g.config(redirectURL)
	ctx = context.WithValue(ctx, oauth2.HTTPClient, g.httpClient)
	tok, err := cfg.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return GoogleUser{}, fmt.Errorf("tukar kode: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, UserinfoURL, nil)
	if err != nil {
		return GoogleUser{}, err
	}
	tok.SetAuthHeader(req)
	res, err := g.httpClient.Do(req)
	if err != nil {
		return GoogleUser{}, fmt.Errorf("userinfo: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		return GoogleUser{}, fmt.Errorf("userinfo status %d", res.StatusCode)
	}
	var u GoogleUser
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<16)).Decode(&u); err != nil {
		return GoogleUser{}, fmt.Errorf("userinfo decode: %w", err)
	}
	if u.Sub == "" || u.Email == "" {
		return GoogleUser{}, errors.New("userinfo tidak lengkap")
	}
	return u, nil
}
