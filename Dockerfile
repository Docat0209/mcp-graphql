FROM node:22-slim
RUN npm install -g mcp-graphql
ENTRYPOINT ["mcp-graphql"]
