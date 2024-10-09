FROM public.ecr.aws/docker/library/golang:1.23.2-bookworm AS build
WORKDIR /code
COPY ./code /code

# Enable this if you are seeing timeout errors. (ex dial tcp: lookup proxy.golang.org ... i/o timeout)
# RUN go env -w GOPROXY=direct

RUN go mod download
RUN go build -o main main.go

FROM public.ecr.aws/docker/library/golang:1.23.2-bookworm AS runtime

WORKDIR /code
COPY --from=build /code/main .
EXPOSE 8080

RUN useradd app
USER app
CMD ["/code/main"]
