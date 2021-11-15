"use strict";

const fs = require("fs");
const mime = require("mime");
const axios = require("axios");

const rootDir = process.cwd();

let bookData;

module.exports = {
  lifecycles: {
    // Called before an entry is created
    async beforeCreate(data) {
      if (data.isbn && !data.titre) {
        bookData = await strapi.services.livre.findBook(data.isbn);
        if (!bookData.title)
          throw strapi.errors.badRequest(
            "Vous devez entrer les informations à la main"
          );

        data.titre = bookData.title;
        data.pages = bookData.pages;
        data.date = new Date(bookData.date);
        data.description = bookData.description;

        data.slug = await strapi.plugins[
          "content-manager"
        ].services.uid.generateUIDField({
          contentTypeUID: "application::livre.livre",
          field: "slug",
          data: data,
        });

        if (bookData.image) {
          const coverPath = rootDir + "/public/uploads/" + data.slug + ".jpg";

          const coverData = await axios({
            method: "GET",
            url: bookData.image,
            responseType: "stream",
          });

          await new Promise(async (resolve, reject) => {
            const writeFile = await coverData.data.pipe(
              fs.createWriteStream(coverPath)
            );
            writeFile.on("finish", () => {
              writeFile.close();
              resolve();
            });
          });

          const stats = fs.statSync(coverPath);
          if (stats.size > 1000) {
            const cover = await strapi.plugins.upload.services.upload.upload({
              data: {
                refId: data.id,
                ref: "application::livre.livre",
                field: "couverture",
              },
              files: {
                path: coverPath,
                name: data.slug + ".jpg",
                type: mime.getType(bookData.image)
                  ? mime.getType(bookData.image)
                  : "image/jpeg",
                size: stats.size,
              },
            });
            fs.unlinkSync(coverPath);

            data.couverture = cover[0].id;
          }
        }
      }
    },
    async afterCreate(result, data) {
      if (bookData.authors) {
        await bookData.authors.forEach(async (author) => {
          const authorData = await strapi.services.auteur.findAuthor(author);
          if (authorData) {
            const strapiAuthor = await strapi
              .query("auteur")
              .findOne({ nom: authorData.name });
            if (!strapiAuthor) {
              await strapi.query("auteur").create({
                nom: authorData.name,
                biographie: authorData.biography,
                nationalite: authorData.nationality,
                description: authorData.description,
                livres: [result.id],
              });
            } else {
              strapi
                .query("auteur")
                .update(
                  { id: strapiAuthor.id },
                  { livres: [...strapiAuthor.livres, result.id] }
                );
            }
          }
        });
      }

      if (bookData.translators) {
        await bookData.translators.forEach(async (translator) => {
          const translatorData = await strapi.services.auteur.findAuthor(
            translator
          );
          if (translatorData) {
            const strapiTranslator = await strapi
              .query("auteur")
              .findOne({ nom: translatorData.name });
            if (!strapiTranslator) {
              const biographie = translatorData.bio
                ? typeof translatorData.bio == "string"
                  ? translatorData.bio
                  : translatorData.bio.value
                  ? translatorData.bio.value
                  : ""
                : "";
              await strapi.query("auteur").create({
                nom: translatorData.name,
                biographie,
                traducteur: true,
                livres: [result.id],
              });
            } else {
              strapi
                .query("auteur")
                .update(
                  { id: strapiTranslator.id },
                  { livres: [...strapiTranslator.livres, result.id] }
                );
            }
          }
        });
      }

      if (bookData.publisher) {
        const strapiPublisher = await strapi
          .query("editeur")
          .findOne({ nom: bookData.publisher });

        if (!strapiPublisher)
          await strapi.query("editeur").create({
            nom: bookData.publisher,
            livres: [result.id],
          });
        else
          await strapi
            .query("editeur")
            .update(
              { id: strapiPublisher.id },
              { livres: [...strapiPublisher.livres, result.id] }
            );
      }

      if (bookData.collection) {
        const strapiCollection = await strapi
          .query("collection")
          .findOne({ nom: bookData.collection });
        if (!strapiCollection)
          await strapi
            .query("collection")
            .create({ nom: bookData.collection, livres: [result.id] });
        else
          await strapi
            .query("collection")
            .update(
              { id: strapiCollection.id },
              { livres: [...strapiCollection.livres, result.id] }
            );
      }
    },
  },
};
