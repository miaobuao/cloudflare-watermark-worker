import * as Image from '@miaobuao/image-wasm';

declare interface Env {
	NETA_R2: R2Bucket;
	WATERMARK_URL: string;
	AUTH_KEY_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const key = url.pathname.slice(1);
		if (!authorizeRequest(request, env, key)) {
			return new Response('Forbidden', { status: 403 });
		}
		switch (request.method) {
			case 'PUT':
				await env.NETA_R2.put(key, request.body);
				return new Response(`Put ${key} successfully!`);
			case 'GET':
				const a = request.headers.get('with-mask');
				const object = await env.NETA_R2.get(key);
				if (object === null) {
					return new Response('Object Not Found', { status: 404 });
				}
				const headers = new Headers();
				object.writeHttpMetadata(headers);
				headers.set('etag', object.httpEtag);
				const hasWatermark = (url.searchParams.get('watermark') ?? 'true') === 'false' ? false : true;
				if (hasWatermark) {
					await Image.initSync();
					const img = new Uint8Array(await object.arrayBuffer());
					const watermark = await fetch(env.WATERMARK_URL).then(async (d) => new Uint8Array(await d.arrayBuffer()));
					const res = Image.merge_image(img, watermark, [10, 10], 0.8);
					if (!res) {
						return new Response('', { status: 500 });
					}
					const blob = new Blob([res]);
					const stream = blob.stream();
					return new Response(stream, {
						headers,
					});
				} else {
					return new Response(object.body, {
						headers,
					});
				}
			case 'DELETE':
				await env.NETA_R2.delete(key);
				return new Response('Deleted!');
			default:
				return new Response('Method Not Allowed', {
					status: 405,
					headers: {
						Allow: 'PUT, GET, DELETE',
					},
				});
		}
	},
};

function hasValidHeader(request: Request, env: Env) {
	return request.headers.get('X-Custom-Auth-Key') === env.AUTH_KEY_SECRET;
}

function authorizeRequest(request: Request, env: Env, key: string) {
	switch (request.method) {
		case 'PUT':
		case 'DELETE':
			return hasValidHeader(request, env);
		case 'GET':
			return true;
		default:
			return false;
	}
}
