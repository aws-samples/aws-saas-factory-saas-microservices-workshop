FROM public.ecr.aws/docker/library/golang:1.20.7-bookworm AS build
WORKDIR /code
COPY ./code /code

# Enable this if you are seeing timeout errors. (ex dial tcp: lookup proxy.golang.org ... i/o timeout)
# RUN go env -w GOPROXY=direct

RUN go mod download
RUN go build -o main main.go

FROM public.ecr.aws/docker/library/golang:1.20.7-bookworm AS runtime

WORKDIR /code
COPY --from=build /code/main .
EXPOSE 8080

RUN apt-get update && apt-get install -y curl

RUN useradd app
USER app
HEALTHCHECK CMD curl --fail http://localhost:8080/health || exit 1
CMD ["/code/main"]
