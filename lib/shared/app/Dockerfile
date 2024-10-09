FROM public.ecr.aws/docker/library/python:3.11.9-slim-bookworm

ENV APP_USER=app
ENV APP_DIR=/home/${APP_USER}/code
ENV APP_SHARED_DIR=${APP_DIR}/shared

RUN useradd -m $APP_USER && mkdir -p $APP_SHARED_DIR && chown "${APP_USER}:${APP_USER}" -R $APP_DIR
USER $APP_USER
ENV PATH="/home/${APP_USER}/.local/bin:${PATH}"

WORKDIR $APP_SHARED_DIR
COPY ./code/requirements.txt ${APP_SHARED_DIR}/requirements.txt

RUN pip install --user --no-cache-dir --requirement $APP_SHARED_DIR/requirements.txt

COPY ./code $APP_SHARED_DIR
