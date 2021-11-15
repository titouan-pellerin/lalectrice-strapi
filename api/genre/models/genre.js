"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      if (data.nom)
        data.slug = await strapi.plugins[
          "content-manager"
        ].services.uid.generateUIDField({
          contentTypeUID: "application::genre.genre",
          field: "slug",
          data: data,
        });
    },
  },
};
