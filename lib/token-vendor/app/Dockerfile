FROM public.ecr.aws/docker/library/golang:1.19.0-bullseye AS build
WORKDIR /code
COPY ./code /code
RUN go env -w GOPROXY=direct && go mod download
RUN go env -w GOPROXY=direct && go build -o main main.go

FROM public.ecr.aws/docker/library/golang:1.19.0-bullseye AS runtime

WORKDIR /code
COPY --from=build /code/main .
EXPOSE 8080

RUN apt-get update && apt-get install -y curl

RUN useradd app
USER app
HEALTHCHECK CMD curl --fail http://localhost:8080/health || exit 1
CMD ["/code/main"]
