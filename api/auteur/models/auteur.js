"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */
const fs = require("fs");
const mime = require("mime");
const axios = require("axios");

const rootDir = process.cwd();

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      if (data.nom && data.slug) {
        const authorData = await strapi.services.auteur.findAuthor(data.nom);
        if (!authorData.name)
          throw strapi.errors.badRequest(
            "Vous devez entrer les informations à la main"
          );

        data.biographie = authorData.biography;
        data.nationalite = authorData.nationality;
        data.description = authorData.description;

        if (authorData.photo) {
          const photoPath = rootDir + "/public/uploads/" + data.slug + ".jpg";

          const photoData = await axios({
            method: "GET",
            url: authorData.photo,
            responseType: "stream",
          });

          await new Promise(async (resolve, reject) => {
            const writeFile = await photoData.data.pipe(
              fs.createWriteStream(photoPath)
            );
            writeFile.on("finish", () => {
              writeFile.close();
              resolve();
            });
          });

          const stats = fs.statSync(photoPath);
          if (stats.size > 1000) {
            const cover = await strapi.plugins.upload.services.upload.upload({
              data: {
                refId: data.id,
                ref: "application::auteur.auteur",
                field: "photo",
              },
              files: {
                path: photoPath,
                name: data.slug + ".jpg",
                type: mime.getType(authorData.photo)
                  ? mime.getType(authorData.photo)
                  : "image/jpeg",
                size: stats.size,
              },
            });
            fs.unlinkSync(photoPath);

            data.photo = cover[0].id;
          }
        }
      } else
        data.slug = await strapi.plugins[
          "content-manager"
        ].services.uid.generateUIDField({
          contentTypeUID: "application::auteur.auteur",
          field: "slug",
          data: data,
        });
    },
  },
};
