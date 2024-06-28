package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/aws/aws-sdk-go/service/verifiedpermissions"
	"github.com/golang-jwt/jwt/v4"
)

var roleARN string = os.Getenv("ROLE_ARN")
var tagKey string = os.Getenv("TENANT_TAG_KEY")
var tokenVendorEndpointPort string = os.Getenv("TOKEN_VENDOR_ENDPOINT_PORT")
var awsRegion string = os.Getenv("AWS_DEFAULT_REGION")
var authorizationResource = os.Getenv("AUTH_RESOURCE")
var policyStoreId = os.Getenv("POLICY_STORE_ID")
// var authorizationMapString = os.Getenv("AUTH_MAP")
var authorizationMapString = `[
	{"Pattern": "^POST \\/products\\/?$", "Action": "CreateProduct"},
	{"Pattern": "^GET \\/products(?:\\/.*)?", "Action": "ViewProduct"},
	{"Pattern": "^POST \\/orders\\/?$", "Action": "CreateOrder"},
	{"Pattern": "^GET \\/orders(?:\\/.*)?", "Action": "ViewOrder"}
]`
var authMaps []AuthorizationMap

func main() {
	// Load authMaps
	if err := json.Unmarshal([]byte(authorizationMapString), &authMaps); err != nil {
		log.Printf("Cannot load auth map: %v", err)
	} else {
		log.Printf("Loaded auth maps: %+v\n", authMaps)
	}

	http.Handle("/health", http.HandlerFunc(health))
	http.Handle("/authorize/", http.HandlerFunc(authorizeAction)) //any path /authorize/*
	http.Handle("/", http.HandlerFunc(getCredentials))
	http.ListenAndServe("127.0.0.1:"+tokenVendorEndpointPort, nil)
}

type JWTClaims struct {
	Sub        string `json:"sub"`
	Role       string `json:"custom:role"`
	TenantID   string `json:"custom:tenant_id"`
	TenantTier string `json:"custom:tenant_tier"`
	jwt.StandardClaims
}

type AuthorizationMap struct {
	Pattern string
	Action  string
}

func mapResourceAction(method string, path string) string {
	route := method + " " + path
	for _, pair := range authMaps {
		re := regexp.MustCompile(pair.Pattern)
		if re.MatchString(route) {
			return pair.Action
		}
	}
	log.Printf("No suitable action found for %s\n", route)
	return ""
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

func authorizeAction(w http.ResponseWriter, r *http.Request) {
	log.Printf("authorizeAction")

	bearerToken := r.Header.Get("Authorization")
	if bearerToken == "" {
		w.WriteHeader(http.StatusBadRequest)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "BearerToken missing!"))
		return
	}

	authorization := strings.Replace(bearerToken, "Bearer ", "", 1)

	token, err := jwt.ParseWithClaims(authorization, &JWTClaims{},
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

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		w.WriteHeader(http.StatusBadRequest)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "failed to read claims!"))
		log.Fatalf("failed to read claims! Err: %s", err)
		return
	}

	requestMethod := r.Header.Get("x-auth-request-method")
	requestPath := r.Header.Get("x-auth-request-path")
	action := mapResourceAction(requestMethod, requestPath)

	log.Printf("claims.Sub: %s\n", claims.Sub)
	log.Printf("claims.Role: %s\n", claims.Role)
	log.Printf("claims.TenantID: %s\n", claims.TenantID)
	log.Printf("claims.TenantTier: %s\n", claims.TenantTier)
	log.Printf("Auth request path: %s\n", requestPath)
	log.Printf("Auth request method: %s\n", requestMethod)
	log.Printf("Auth action: %s\n", action)
	log.Printf("Auth resource: %s\n", authorizationResource)


	//Make AVP call here
	// Initialize a session that the SDK uses to load
	log.Printf("Initialize SDK session")
	mySession, err := session.NewSession(&aws.Config{
		Region: &awsRegion,
	})

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "Failed getting AVP!"))
		log.Fatalf("Failed getting new session for AVP! Err: %s", err)
		return
	}

	// Create a new instance of the AWS Verified Permissions service client
	svc := verifiedpermissions.New(mySession)

	// Define the input parameters for the IsAuthorized request
	input := &verifiedpermissions.IsAuthorizedInput{
		PolicyStoreId: aws.String(policyStoreId),
		Principal: &verifiedpermissions.EntityIdentifier{
			EntityType: aws.String("User"),
			EntityId:   aws.String(claims.Sub),
		},
		Action: &verifiedpermissions.ActionIdentifier{
			ActionType: aws.String("Action"),
			ActionId:   aws.String(action),
		},
		Resource: &verifiedpermissions.EntityIdentifier{
			EntityType: aws.String(authorizationResource),
			EntityId:   aws.String(requestPath),     
		},
		Entities: &verifiedpermissions.EntitiesDefinition{
			EntityList: []*verifiedpermissions.EntityItem{
				{
					Identifier: &verifiedpermissions.EntityIdentifier{
						EntityType: aws.String("User"),
						EntityId:   aws.String(claims.Sub),
					},
					Parents: []*verifiedpermissions.EntityIdentifier{
						{
							EntityType: aws.String("Role"),
							EntityId:   aws.String(claims.Role),
						},
					},
				},
			},
		},
	}

	// Call the IsAuthorized method
	output, err := svc.IsAuthorized(input)
	if err != nil {
		log.Printf("Error calling IsAuthorized:", err)
		return
	}

	// Print the response
	log.Printf("IsAuthorized response:", output)

	// Check the response
	if *output.Decision == "ALLOW" { // DecisionAllow
		log.Printf("Result: ALLOW")
		w.WriteHeader(http.StatusOK) 
		return
	} else {
		log.Printf("Result: DENY")
	}

	//return denied
	w.WriteHeader(http.StatusForbidden)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(createJsonResponse("msg", "Access denied!"))
}

func getCredentials(w http.ResponseWriter, r *http.Request) {
	log.Printf("getCredentials")

	ctx := r.Context()
	bearerToken := r.Header.Get("Authorization")
	if bearerToken == "" {
		w.WriteHeader(http.StatusBadRequest)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(createJsonResponse("msg", "BearerToken missing!"))
		return
	}

	authorization := strings.Replace(bearerToken, "Bearer ", "", 1)

	token, err := jwt.ParseWithClaims(authorization, &JWTClaims{},
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

	claims, ok := token.Claims.(*JWTClaims)
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
