# Use the official AWS Lambda Python 3.12 base image
FROM public.ecr.aws/lambda/python:3.12

# Copy  requirements file
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install  dependencies directly into the container
RUN pip install -r requirements.txt --upgrade

# Copy all application code (main.py, routers, lambda_handler.py, etc.)
COPY . ${LAMBDA_TASK_ROOT}

# (Points to the 'handler' variable inside 'lambda_handler.py')
CMD ["lambda_handler.handler"]