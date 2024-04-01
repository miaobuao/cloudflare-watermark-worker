use std::{
    borrow::{Borrow, BorrowMut},
    io::Cursor,
};

use image::{load_from_memory, DynamicImage, ImageFormat};
use worker::*;

#[event(fetch)]
async fn main(mut req: Request, env: Env, ctx: Context) -> Result<Response> {
    let url = req.url().unwrap();
    let key = url.path().strip_prefix("/").unwrap();

    let bkt_binding = env.var("BUCKET_BINDING").unwrap();
    let Ok(bucket) = env.bucket(bkt_binding.to_string().as_str()) else {
        return Response::error("bucket not found", 500);
    };

    match req.method() {
        Method::Put => {
            bucket
                .put(key, req.bytes().await.unwrap())
                .execute()
                .await
                .unwrap();
            return Response::ok("ok");
        }
        Method::Get => {
            let Some(source) = bucket.get(key).execute().await.unwrap() else {
                return Response::error("not found", 404);
            };
            let mut headers = Headers::new();
            headers.set("etag", source.etag().as_str()).unwrap();
            source.write_http_metadata(headers.to_owned()).unwrap();
            let source_data = source.body().unwrap().bytes().await.unwrap();

            let mark_key = env.var("WATERMARK_KEY").unwrap();
            let Some(mark_obj) = bucket
                .get(mark_key.to_string().as_str())
                .execute()
                .await
                .unwrap()
            else {
                return Response::error("watermark not found", 404);
            };
            let mark_data = mark_obj.body().unwrap().bytes().await.unwrap();

            let mut source_img = load_from_memory(source_data.as_slice()).unwrap();
            let mark_img = load_from_memory(mark_data.as_slice()).unwrap();

            let position_x = source_img.width() - mark_img.width();
            let position_y = source_img.height() - mark_img.height();
            image::imageops::overlay(
                source_img.borrow_mut(),
                mark_img.borrow(),
                position_x.into(),
                position_y.into(),
            );

            let res = encode_image_to_bytes(&source_img).unwrap();

            return Ok(Response::from_bytes(res).unwrap().with_headers(headers));
        }
        Method::Delete => {
            bucket.delete(key).await.unwrap();
            return Response::ok("deleted");
        }
        _ => {
            return Response::error("method not allowed", 405);
        }
    }
}

fn encode_image_to_bytes(img: &DynamicImage) -> Option<Vec<u8>> {
    let mut bytes: Vec<u8> = Vec::new();
    match img.write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png) {
        Ok(_) => Some(bytes),
        Err(_) => None,
    }
}
