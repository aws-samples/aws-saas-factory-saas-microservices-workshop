package main

import (
	"encoding/json"
	"log"	
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/golang-jwt/jwt/v4"
)

var roleARN string = os.Getenv("ROLE_ARN")
var tagKey string = os.Getenv("TENANT_TAG_KEY")
var tokenVendorEndpointPort string = os.Getenv("TOKEN_VENDOR_ENDPOINT_PORT")
var awsRegion string = os.Getenv("AWS_DEFAULT_REGION")

func main() {
	http.Handle("/health", http.HandlerFunc(health))
	http.Handle("/", http.HandlerFunc(getCredentials))
	http.ListenAndServe("127.0.0.1:"+tokenVendorEndpointPort, nil)
}

type CustomJWTClaim struct {
	TenantID   string `json:"custom:tenant_id"`
	TenantTier string `json:"custom:tenant_tier"`
	jwt.StandardClaims
}

func createJsonResponse(key string, value string) map[string]string {
	resp := make(map[string]string)
	resp[key] = value
	return resp
}

func health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(createJsonResponse("status", "Ok!"))
}

func getCredentials(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	bearerToken := r.Header.Get("Authorization")
	if bearerToken == "" {
		w.WriteHeader(http.StatusBadRequest)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "BearerToken missing!"))
		return
	}

	authorization := strings.Replace(bearerToken, "Bearer ", "", 1)

	token, err := jwt.ParseWithClaims(authorization, &CustomJWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(""), nil
		})

	if token == nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "Failed to parse claims!"))
		log.Fatalf("failed to parse claims! Err: %s", err)
		return
	}

	claims, ok := token.Claims.(*CustomJWTClaim)
	if !ok {
		w.WriteHeader(http.StatusBadRequest)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "failed to read claims!"))
		log.Fatalf("failed to read claims! Err: %s", err)
		return
	}

	log.Printf("claims.TenantID: %s\n", claims.TenantID)
	log.Printf("claims.TenantTier: %s\n", claims.TenantTier)
	log.Printf("authorization: %s\n", authorization)

	mySession, err := session.NewSession(&aws.Config{
		Region: &awsRegion,
	})

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "Failed getting caller identity!"))
		log.Fatalf("Failed getting new session! Err: %s", err)
		return
	}

	svc := sts.New(mySession)
	input := &sts.GetCallerIdentityInput{}
	identity, err := svc.GetCallerIdentityWithContext(ctx, input)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "Failed getting caller identity!"))
		log.Fatalf("Failed getting caller identity! Err: %s", err)
		return
	}

	log.Printf("My Caller Identity: %s\n", identity)

	sessionName := claims.TenantID
	result, err := svc.AssumeRoleWithContext(ctx, &sts.AssumeRoleInput{
		RoleArn:         &roleARN,
		RoleSessionName: &sessionName,
		Tags: []*sts.Tag{
			{
				Key:   &tagKey,
				Value: &claims.TenantID,
			},
		},
	})

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "Failed assuming role!"))
		log.Fatalf("Failed assuming role! Err: %s", err)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]interface{}{"Credentials": *result.Credentials, "TenantId": claims.TenantID, "TenantTier": claims.TenantTier}

	json.NewEncoder(w).Encode(resp)
}
