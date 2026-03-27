# TokenForGood Sandbox Base Image
# Ephemeral container per task — destroyed after completion.
# Root filesystem is read-only; all writes go to tmpfs mounts.

FROM node:20-slim

# Install bubblewrap (Layer 2 OS-level sandbox) and git
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bubblewrap \
    git \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Set the setuid bit on bwrap as a fallback for environments
# without unprivileged user namespaces
RUN chmod u+s /usr/bin/bwrap

# Create non-root sandbox user
RUN groupadd --gid 1000 sandbox \
  && useradd --uid 1000 --gid sandbox --create-home sandbox

# Create workspace and .tokenforgood log directory
RUN mkdir -p /workspace/.tokenforgood \
  && chown -R sandbox:sandbox /workspace

# Create Claude auth and config directories
RUN mkdir -p /tmp/claude-auth /home/sandbox/.claude \
  && chown -R sandbox:sandbox /tmp/claude-auth /home/sandbox/.claude

# Write .npmrc to block lifecycle scripts (Shai-Hulud defense)
RUN echo 'ignore-scripts=true' > /home/sandbox/.npmrc \
  && chown sandbox:sandbox /home/sandbox/.npmrc

# Belt-and-suspenders: also set via env var
ENV npm_config_ignore_scripts=true

# Proxy env vars are set at runtime via docker create --env
# HTTP_PROXY and HTTPS_PROXY point to the sidecar tinyproxy container

WORKDIR /workspace
USER sandbox
