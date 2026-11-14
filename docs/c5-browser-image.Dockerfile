# PREPARATION ONLY. No image has been pulled, built, imported or published.
# BASE_IMAGE must be the verified linux/amd64 digest of this exact official tag:
# mcr.microsoft.com/playwright:v1.55.0-noble@sha256:<verified 64-hex digest>
# Use a newly staged context containing ONLY the two verified archives and this
# recipe/qualifier. Never use the CallerCore checkout as a Docker build context.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
ARG BASE_IMAGE
ENV C5_BROWSER_BASE_IMAGE=${BASE_IMAGE}
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /opt/callercore-browser
COPY playwright-1.55.0.tgz playwright-core-1.55.0.tgz ./
COPY c5-browser-image-verify.cjs ./
RUN printf '%s\n' 'f9b9876bde4f0508941775648c673a2a94d34aefe38312a1fa3c9440d686d073  playwright-1.55.0.tgz' '6b63fdf41725afb924880728d39cf560d770f785a861d18c15611e99dd3172bd  playwright-core-1.55.0.tgz' | sha256sum --check --strict - \
    && mkdir -p node_modules/playwright node_modules/playwright-core \
    && tar -xzf playwright-1.55.0.tgz -C node_modules/playwright --strip-components=1 \
    && tar -xzf playwright-core-1.55.0.tgz -C node_modules/playwright-core --strip-components=1 \
    && rm playwright-1.55.0.tgz playwright-core-1.55.0.tgz \
    && chmod -R a-w /opt/callercore-browser \
    && mkdir -p /vercel/sandbox && chown pwuser:pwuser /vercel/sandbox
USER pwuser
RUN node /opt/callercore-browser/c5-browser-image-verify.cjs --dependencies-only
WORKDIR /vercel/sandbox
# Sandbox ignores image ENTRYPOINT/CMD. The separately approved orchestrator must
# explicitly run the fixed qualifier as pwuser; no ports or background service.
