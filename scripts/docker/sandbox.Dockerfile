FROM node:24

WORKDIR /app

ENV EDITOR=nvim

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    ca-certificates \
    ripgrep \
    neovim

# install github cli
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh

RUN npm install -g lalph@latest @anthropic-ai/claude-code@latest opencode-ai@latest

COPY scripts/docker/sandbox-entry.sh /usr/local/bin/sandbox-entry.sh
RUN chmod +x /usr/local/bin/sandbox-entry.sh

ENTRYPOINT ["/usr/local/bin/sandbox-entry.sh"]
