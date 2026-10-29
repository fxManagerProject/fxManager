ARG BUN_VERSION=1.4.4
ARG DEBIAN_VERSION=bookworm-slim

FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /build

COPY . .

RUN apt-get update && apt-get install python3 make -y
RUN bun install --frozen-lockfile
RUN bun run build

FROM debian:${DEBIAN_VERSION} AS server

ENV PANEL_PORT=4000
ENV FXSERVER_AUTOSTART=false
ENV FXSERVER_EXECUTABLE=/home/fxserver/alpine/opt/cfx-server/FXServer
ENV FXSERVER_DATA_PATH=/home/fxserver/server-data

ARG ARTIFACTS_API_URL=https://artifacts.jgscripts.com/jsonv2

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl tini xz-utils \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /server

COPY --from=builder /build/dist/fxmanager-linux /server/fxmanager
COPY --from=builder /build/dist/assets /server/assets
RUN chmod +x /server/fxmanager

WORKDIR /home/fxserver

RUN set -eux; \
	artifact_url="$(curl --fail --location --silent "${ARTIFACTS_API_URL}" \
		| sed -n 's/.*"linuxDownloadLink":"\([^"]*\)".*/\1/p')"; \
	test -n "${artifact_url}"; \
	curl --fail --location --show-error --silent "${artifact_url}" \
		| tar -xJf - -C /home/fxserver

COPY --from=builder /build/dist/fxManager /home/fxserver/alpine/opt/cfx-server/citizen/system_resources/fxManager

RUN rm -f /home/fxserver/run.sh \
		&& rm -rf /home/fxserver/alpine/opt/cfx-server/citizen/system_resources/monitor \
		&& mkdir -p /home/fxserver/server-data /server/data \
		&& useradd --system --user-group --home-dir /D fxserver \
		&& chown -R fxserver:fxserver /home/fxserver /server/data

VOLUME [ "/home/fxserver/server-data" ]
VOLUME [ "/server/data" ]

ENV HOME=/home/fxserver
USER fxserver
WORKDIR /server

EXPOSE 30120/tcp
EXPOSE 30120/udp
EXPOSE ${PANEL_PORT}/tcp

ENTRYPOINT [ "/usr/bin/tini", "--", "/server/fxmanager" ]
