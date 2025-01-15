#!/bin/bash

# Optional: remove any old container named 'oblech_mongo'
docker rm -f oblech_mongo 2>/dev/null

# 1. Run Mongo container, mapping container port 27017 to host port 27018.
docker run -d -p 27018:27017 --name oblech_mongo mongo:latest

# 2. Wait a few seconds for Mongo to start
sleep 5

# 3. Copy your users.json file into the container
docker cp ./users.json oblech_mongo:/users.json

# 4. Import into 'oblech' database, 'users' collection
docker exec -i oblech_mongo mongoimport \
  --db oblech \
  --collection users \
  --file /users.json \
  --jsonArray

echo "Mongo container 'oblech_mongo' started on host port 27018, and users.json imported!"
echo "Use 'docker exec -it oblech_mongo bash' to explore the DB."
