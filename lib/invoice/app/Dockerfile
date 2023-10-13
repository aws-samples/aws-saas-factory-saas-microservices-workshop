ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ENV APP_USER=app
ENV APP_DIR=/home/${APP_USER}/code
ENV APP_SHARED_DIR=${APP_DIR}/shared

RUN useradd -m $APP_USER && mkdir -p $APP_SHARED_DIR && chown "${APP_USER}:${APP_USER}" -R $APP_DIR || echo "user already exists" 
USER $APP_USER

ENV PATH="/home/${APP_USER}/.local/bin:${PATH}"

WORKDIR $APP_DIR
COPY ./code/requirements.txt ${APP_DIR}/requirements.txt

RUN pip install --user --no-cache-dir --requirement ${APP_DIR}/requirements.txt
COPY ./code $APP_DIR

CMD ["python", "app.py"]
