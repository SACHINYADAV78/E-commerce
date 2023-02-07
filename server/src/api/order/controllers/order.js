"use strict";

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async customOrderController(ctx) {
    try {
      const bodyData = ctx.body;
      const entries = await strapi.entityService.findMany(
        "api::product.product",
        {
          fields: ["title"],
          limit: 2,
        }
      );
      return { data: entries };
    } catch (err) {
      ctx.body = err;
    }
  },
  async create(ctx) {
    try {
      const { products } = ctx.request.body;

      const lineItem = await Promise.all(
        products.map(async (product) => {
          const productEntities = await strapi.entityService.findMany(
            "api::product.product",
            {
              filters: {
                key: product.key,
              },
            }
          );
          const realProduct = productEntities[0];
          // const image = product.image
          return {
            price_data: {
              currency: "inr",
              product_data: {
                name: realProduct.title,
                images: [product.image],
              },
              unit_amount: realProduct.price * 100,
            },
            quantity: product.quantity,
          };
        })
      );

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: {
          allowed_countries: ["IN"],
        },
        line_items: lineItem,
        mode: "payment",
        success_url: `${process.env.CLIENT_BASED_URL}/payments/sucess`,
        cancel_url: `${process.env.CLIENT_BASED_URL}/payments/failed`,
      });

      await strapi.entityService.create("api::order.order", {
        data: {
          products,
          strapiId: session.id,
        },
      });

      // console.log(strapiId);
      return { strapiId: session.id };
    } catch (error) {
      console.log(error);
      ctx.response.status = 500;
      return error;
    }
  },
}));
