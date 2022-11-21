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

# # switch back to root user temporarily to grab and unzip shared lib files.
# USER root
# ENV COMMIT_ID="e0b2979bff525be25ac7f9a11f0066cf078fbb24"
# ADD https://github.com/aws-samples/aws-saas-factory-saas-microservices-workshop/archive/${COMMIT_ID}.zip ${COMMIT_ID}.zip

# RUN unzip ${COMMIT_ID}.zip \
#     && mv aws-saas-factory-saas-microservices-workshop-${COMMIT_ID}/lib/shared/* . \
#     && rm -rf ${COMMIT_ID}.zip aws-saas-factory-saas-microservices-workshop-${COMMIT_ID}
# USER $APP_USER

# RUN pip install --user --no-cache-dir --requirement $APP_SHARED_DIR/requirements.txt

WORKDIR $APP_DIR
COPY ./code/requirements.txt ${APP_DIR}/requirements.txt

RUN pip install --user --no-cache-dir --requirement ${APP_DIR}/requirements.txt
COPY ./code $APP_DIR

HEALTHCHECK CMD curl --fail http://localhost:8080/products/health || exit 1
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8080", "--log-level=debug"]
