import * as Image from '@miaobuao/image-wasm';
import { imageMeta } from 'image-meta';

declare interface Env {
	NETA_R2: R2Bucket;

	/** env vars */
	WATERMARK_KEY?: string;
	WATERMARK_URL?: string;
	AUTH_KEY_SECRET: string;
}

const WatermarkNotFound = new Response('watermark not found.', { status: 500 });

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
				const object = await env.NETA_R2.get(key);
				if (object === null) {
					return new Response('Object Not Found', { status: 404 });
				}
				const headers = new Headers();
				object.writeHttpMetadata(headers);
				headers.set('etag', object.httpEtag);
				const hasWatermark = (url.searchParams.get('watermark') ?? '') === 'false' ? false : true;
				if (hasWatermark) {
					const bg = new Uint8Array(await object.arrayBuffer());
					if (env.WATERMARK_KEY) {
						const watermarkObj = await env.NETA_R2.get(env.WATERMARK_KEY);
						if (watermarkObj === null) {
							return WatermarkNotFound;
						}
						var watermark = new Uint8Array(await watermarkObj.arrayBuffer());
					} else if (env.WATERMARK_URL) {
						var watermark = await fetchImage(env.WATERMARK_URL);
					} else {
						return WatermarkNotFound;
					}
					const res = await putWatermark(bg, watermark);
					if (!res) {
						return new Response('watermark service error', { status: 500 });
					}
					const blob = new Blob([res]);
					const stream = blob.stream();
					return new Response(stream, { headers });
				} else {
					return new Response(object.body, { headers });
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

async function putWatermark(bg: Uint8Array, watermark: Uint8Array, opacity = 1) {
	await Image.initSync();
	const watermarkMeta = imageMeta(watermark);
	const bgMeta = imageMeta(bg);
	const position = [bgMeta.width! - watermarkMeta.width!, bgMeta.height! - watermarkMeta.height!];
	const res = Image.merge_image(bg, watermark, position, opacity);
	return res;
}

async function fetchImage(url: string) {
	return fetch(url).then(async (d) => new Uint8Array(await d.arrayBuffer()));
}

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
