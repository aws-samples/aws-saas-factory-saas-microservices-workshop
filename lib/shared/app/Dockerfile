FROM public.ecr.aws/docker/library/python:3.9.14-slim-bullseye

ENV APP_USER=app
ENV APP_DIR=/home/${APP_USER}/code
ENV APP_SHARED_DIR=${APP_DIR}/shared

RUN useradd -m $APP_USER && mkdir -p $APP_SHARED_DIR && chown "${APP_USER}:${APP_USER}" -R $APP_DIR
USER $APP_USER

WORKDIR $APP_SHARED_DIR
RUN pip install --user --no-cache-dir --requirement $APP_SHARED_DIR/requirements.txt
