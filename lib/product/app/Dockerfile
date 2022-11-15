FROM public.ecr.aws/docker/library/python:3.9.14-slim-bullseye

ENV APP_USER=app
ENV APP_DIR=/home/${APP_USER}/code
ENV APP_SHARED_DIR=${APP_DIR}/shared

RUN apt-get update && apt-get install -y curl unzip
RUN useradd -m $APP_USER && mkdir -p $APP_SHARED_DIR && chown "${APP_USER}:${APP_USER}" -R $APP_DIR
USER $APP_USER

ENV PATH="/home/${APP_USER}/.local/bin:${PATH}"

# LAB 3: UNCOMMENT BELOW (dockerfile)
# WORKDIR $APP_SHARED_DIR

# COPY ./code/shared/lib.zip $APP_SHARED_DIR
# RUN unzip lib.zip && mv my-shared-libs/* . && rm -rf lib.zip my-shared-libs

RUN pip install --user --no-cache-dir --upgrade -r $APP_SHARED_DIR/requirements.txt

WORKDIR $APP_DIR
COPY ./code/requirements.txt ${APP_DIR}/requirements.txt

RUN pip install --user --no-cache-dir --upgrade -r ${APP_DIR}/requirements.txt
COPY ./code $APP_DIR

HEALTHCHECK CMD curl --fail http://localhost:8080/products/health || exit 1
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8080"]
