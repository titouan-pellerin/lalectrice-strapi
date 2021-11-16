"use strict";

const axios = require("axios");
const xml2js = require("xml2js");
const parser = new xml2js.Parser();

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
  findAuthor: async (author) => {
    let returnData = {
      name: null,
      biography: null,
      nationality: null,
      photo: null,
      description: null,
    };
    let openLibraryAuthor, bnfAuthor;

    if (author.name) {
      openLibraryAuthor = await openLibraryData(author.name);
      bnfAuthor = await bnfData(author);

      returnData.name = bnfAuthor.name
        ? bnfAuthor.name
        : openLibraryAuthor.name;
      returnData.biography = bnfAuthor.biography
        ? bnfAuthor.biography
        : openLibraryAuthor.biography;

      returnData.nationality = bnfAuthor.nationality;

      returnData.photo = openLibraryAuthor.photo;
      returnData.description = bnfAuthor.description
        ? bnfAuthor.description
        : openLibraryAuthor.description;
    } else {
      openLibraryAuthor = await openLibraryData(author);

      returnData.name = openLibraryAuthor.name;
      returnData.biography = openLibraryAuthor.biography;
      returnData.photo = openLibraryAuthor.photo;
      returnData.description = openLibraryAuthor.description;
    }

    return returnData;
  },
};

const openLibraryData = async (author) => {
  let name = null,
    biography = null,
    nationality = null,
    photo = null,
    description = null;

  if (author.key) {
    try {
      let key = author.key;
      if (key.includes("authors")) key = key.split("/")[2];
      const { data } = await axios.get(
        `https://openlibrary.org/authors/${key}.json`
      );

      name = data.name;
      biography = data.bio
        ? typeof data.bio == "string"
          ? data.bio
          : data.bio.value
          ? data.bio.value
          : ""
        : "";

      photo = `https://covers.openlibrary.org/a/olid/${key}-L.jpg`;
    } catch (err) {
      console.log(err);
    }
  } else {
    try {
      const { data } = await axios.get(
        `https://openlibrary.org/search/authors.json?q=${encodeURI(author)}`
      );
      if (data.docs[0]) {
        return await openLibraryData(data.docs[0]);
      }
    } catch (err) {
      console.log(err);
    }
  }

  console.log({
    name,
    biography,
    nationality,
    photo,
    description,
  });

  return {
    name,
    biography,
    nationality,
    photo,
    description,
  };
};

const bnfData = async (author) => {
  let name = null,
    biography = null,
    nationality = null,
    photo = null,
    description = null;

  try {
    const { data } = await axios.get(
      `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=(aut.recordId%20adj%20"${author.id}")`
    );

    const parsedData = await parser.parseStringPromise(data);
    const records = parsedData["srw:searchRetrieveResponse"]["srw:records"];

    let datafields;
    if (records.length > 0) {
      datafields =
        records[0]["srw:record"][0]["srw:recordData"][0]["mxc:record"][0][
          "mxc:datafield"
        ];

      const personNameArray = datafields.filter((field) => field.$.tag == 200);
      const collectivityNameArray = datafields.filter(
        (field) => field.$.tag == 210
      );

      let personName, collectivityName;
      if (personNameArray.length > 0) {
        const lastname = personNameArray[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "a"
        )[0]._;
        const firstnameArray = personNameArray[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "b"
        );
        let firstname = "";
        if (firstnameArray.length > 0) firstname = firstnameArray[0]._;

        personName = firstname + " " + lastname;
        personName = personName.trim();
      }
      if (collectivityNameArray.length > 0) {
        const collectivityFirstName = collectivityNameArray[0][
          "mxc:subfield"
        ].filter((subfield) => subfield.$.code == "a")[0]._;
        const collectivitySubNameArray = collectivityNameArray[0][
          "mxc:subfield"
        ].filter((subfield) => subfield.$.code == "b");

        let collectivitySubName = "";
        if (collectivitySubNameArray.length > 0)
          collectivitySubName = collectivitySubNameArray[0]._;

        collectivityName = collectivityFirstName + " " + collectivitySubName;
        collectivityName = collectivityName.trim();
      }

      name = personName ? personName : collectivityName;

      const descriptionArray = datafields.filter((field) => field.$.tag == 300);
      if (descriptionArray.length > 0) {
        description = descriptionArray[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "a"
        )[0]._;
      }

      const biographyArray = datafields.filter((field) => field.$.tag == 340);
      if (biographyArray.length > 0) {
        biography = biographyArray[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "a"
        )[0]._;
      }

      const nationalityArray = datafields.filter((field) => field.$.tag == 102);
      if (nationalityArray.length > 0) {
        nationality = nationalityArray[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "a"
        )[0]._;
      }
    }
  } catch (err) {
    console.error(err);
  }

  console.log({
    name,
    biography,
    nationality,
    photo,
    description,
  });

  return {
    name,
    biography,
    nationality,
    photo,
    description,
  };
};
