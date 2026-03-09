FROM python:3.12-alpine AS build

RUN apk add --no-cache gcc musl-dev linux-headers zlib-dev jpeg-dev freetype-dev

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-alpine

RUN apk add --no-cache zlib libjpeg-turbo freetype

COPY --from=build /install /usr/local

WORKDIR /app
COPY . .

CMD ["python", "main.py"]
