FROM node:14

WORKDIR /app

# install dependencies
COPY package.json /app
RUN npm install

# pull in code
COPY . /app
EXPOSE 8080
CMD ["npm", "start"]
