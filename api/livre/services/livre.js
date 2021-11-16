"use strict";

const axios = require("axios");
const xml2js = require("xml2js");
const parser = new xml2js.Parser();

module.exports = {
  findBook: async (isbn) => {
    const googleBook = await googleBooksData(isbn);
    const openLibraryBook = await openLibraryData(isbn);
    const bnfBook = await bnfData(isbn);

    // console.log(googleBook);
    // console.log(openLibraryBook);
    // console.log(bnfBook);

    return combineBookData(googleBook, openLibraryBook, bnfBook);
  },
};

const googleBooksData = async (isbn) => {
  let title = null,
    publisher = null,
    description = null,
    pages = null,
    authors = null,
    collection = null,
    translators = null,
    date = null,
    image = null;

  try {
    const { data } = await axios.get(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${process.env.GOOGLE_API_KEY}`
    );
    title = data.items[0].volumeInfo.title;
    publisher = data.items[0].volumeInfo.publisher;
    date = new Date(data.items[0].volumeInfo.publishedDate);
    description = data.items[0].volumeInfo.description;
    pages = data.items[0].volumeInfo.pageCount
      ? data.items[0].volumeInfo.pageCount
      : 0;
    image = data.items[0].volumeInfo.imageLinks
      ? data.items[0].volumeInfo.imageLinks.thumbnail
      : null;
    authors = data.items[0].volumeInfo.authors;
    collection = null;
    translators = null;
  } catch (err) {
    console.error(err);
  }
  return {
    title,
    publisher,
    date,
    pages,
    authors,
    translators,
    collection,
    description,
    image,
  };
};

const openLibraryData = async (isbn) => {
  let title = null,
    publisher = null,
    description = null,
    pages = null,
    authors = null,
    collection = null,
    translators = null,
    date = null,
    image = null;

  try {
    const { data } = await axios.get(
      `https://openlibrary.org/isbn/${isbn}.json`
    );

    title = data.title;
    publisher = data.publishers ? data.publishers[0] : null;
    date = new Date(data.publish_date);
    pages = data.number_of_pages;
    authors = data.authors;
    collection = data.series ? data.series[0] : null;
    description = data.description ? data.description.value : null;
    image = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    translators = null;
  } catch (err) {
    console.error(err);
  }
  return {
    title,
    publisher,
    date,
    pages,
    authors,
    translators,
    collection,
    description,
    image,
  };
};

const bnfData = async (isbn) => {
  let title = null,
    publisher = null,
    description = null,
    pages = null,
    authors = null,
    collection = null,
    translators = null,
    date = null,
    image = null;

  try {
    const { data } = await axios.get(
      `http://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=bib.isbn%20adj%20%22${isbn}%22`
    );
    const parsedData = await parser.parseStringPromise(data);
    const records = parsedData["srw:searchRetrieveResponse"]["srw:records"];

    if (records.length > 0 && records[0]) {
      const datafields =
        records[0]["srw:record"][0]["srw:recordData"][0]["mxc:record"][0][
          "mxc:datafield"
        ];

      const titleArray = datafields.filter((field) => field.$.tag == 200);
      if (titleArray.length > 0)
        title = titleArray[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "a"
        )[0]._;

      const descriptionArray = datafields.filter((field) => field.$.tag == 330);
      if (descriptionArray.length > 0)
        description = descriptionArray[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "a"
        )[0]._;

      const collectionArray = datafields.filter((field) => field.$.tag == 225);
      if (collectionArray.length > 0)
        collection = collectionArray[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "a"
        )[0]._;

      const pagesArray = datafields.filter((field) => field.$.tag == 215);
      if (pagesArray.length > 0)
        pages = pageNumber(
          pagesArray[0]["mxc:subfield"].filter(
            (subfield) => subfield.$.code == "a"
          )[0]._
        );

      const publisherArray1 = datafields.filter((field) => field.$.tag == 210);
      let publisher1;
      if (publisherArray1.length > 0)
        publisher1 = publisherArray1[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "c"
        )[0]._;

      const publisherArray2 = datafields.filter((field) => field.$.tag == 214);
      let publisher2;
      if (publisherArray2.length > 0)
        publisher2 = publisherArray2[0]["mxc:subfield"].filter(
          (subfield) => subfield.$.code == "c"
        )[0]._;

      publisher = publisher1 ? publisher1 : publisher2 ? publisher2 : null;

      const authorsArray = datafields.filter(
        (field) =>
          field.$.tag == 700 ||
          field.$.tag == 701 ||
          field.$.tag == 702 ||
          field.$.tag == 710 ||
          field.$.tag == 711 ||
          field.$.tag == 712
      );
      if (authorsArray.length > 0) {
        translators = authorsArray
          .filter((authorField) => {
            const translatorField = authorField["mxc:subfield"].filter(
              (subfield) => subfield.$.code == "4"
            );
            if (translatorField.length > 0) return translatorField[0]._ == 730;
          })
          .map((translatorField) => {
            let firstName, lastname, id;
            const firstnameArray = translatorField["mxc:subfield"].filter(
              (subfield) => subfield.$.code == "b"
            );
            if (firstnameArray.length > 0) firstName = firstnameArray[0]._;

            const lastnameArray = translatorField["mxc:subfield"].filter(
              (subfield) => subfield.$.code == "a"
            );
            if (lastnameArray.length > 0) lastname = lastnameArray[0]._;

            const idArray = translatorField["mxc:subfield"].filter(
              (subfield) => subfield.$.code == "3"
            );

            if (idArray.length > 0) id = idArray[0]._;

            return { name: firstName + " " + lastname, id };
          });

        authors = authorsArray
          .filter((authorField) => {
            const translatorField = authorField["mxc:subfield"].filter(
              (subfield) => subfield.$.code == "4"
            );
            if (translatorField.length > 0) return translatorField[0]._ != 730;
          })
          .map((authorField) => {
            let firstName, lastname, id;

            const firstnameArray = authorField["mxc:subfield"].filter(
              (subfield) => subfield.$.code == "b"
            );
            if (firstnameArray.length > 0) firstName = firstnameArray[0]._;

            const lastnameArray = authorField["mxc:subfield"].filter(
              (subfield) => subfield.$.code == "a"
            );
            if (lastnameArray.length > 0) lastname = lastnameArray[0]._;

            const idArray = authorField["mxc:subfield"].filter(
              (subfield) => subfield.$.code == "3"
            );

            if (idArray.length > 0) id = idArray[0]._;

            return { name: firstName + " " + lastname, id };
          });
      }
    }
  } catch (err) {
    console.error(err);
  }
  return {
    title,
    publisher,
    date,
    pages,
    authors,
    translators,
    collection,
    description,
    image,
  };
};

const pageNumber = (string) => {
  const pageNumberRegex = /\d{2,4}/;
  let match;
  if ((match = pageNumberRegex.exec(string)) !== null) return Number(match[0]);
  return null;
};

const chooseBookData = (
  googleBookData,
  openLibraryBookData,
  bnfBookData,
  openlibraryWeight,
  bnfWeight
) => {
  const first =
    bnfWeight === 2
      ? bnfBookData
      : openlibraryWeight === 2
      ? openLibraryBookData
      : googleBookData;
  const second =
    bnfWeight === 1
      ? bnfBookData
      : openlibraryWeight === 1
      ? openLibraryBookData
      : googleBookData;
  const third =
    bnfWeight === 0
      ? bnfBookData
      : openlibraryWeight === 0
      ? openLibraryBookData
      : googleBookData;

  return first ? first : second ? second : third ? third : null;
};

const combineBookData = (googleBook, openLibraryBook, bnfBook) => {
  let returnData = {
    title: null,
    authors: null,
    publisher: null,
    date: null,
    description: null,
    pages: null,
    image: null,
    collection: null,
    translators: null,
  };

  if (bnfBook) returnData.translators = bnfBook.translators;

  returnData.title = chooseBookData(
    googleBook.title,
    openLibraryBook.title,
    bnfBook.title,
    1,
    2
  );

  returnData.authors = chooseBookData(
    googleBook.authors,
    openLibraryBook.authors,
    bnfBook.authors,
    1,
    2
  );

  returnData.publisher = chooseBookData(
    googleBook.publisher,
    openLibraryBook.publisher,
    bnfBook.publisher,
    1,
    2
  );
  returnData.date = chooseBookData(
    googleBook.date,
    openLibraryBook.date,
    bnfBook.date,
    2,
    0
  );
  returnData.description = chooseBookData(
    googleBook.description,
    openLibraryBook.description,
    bnfBook.description,
    1,
    2
  );
  returnData.pages = chooseBookData(
    googleBook.pages,
    openLibraryBook.pages,
    bnfBook.pages,
    2,
    0
  );
  returnData.image = chooseBookData(
    googleBook.image,
    openLibraryBook.image,
    bnfBook.image,
    1,
    0
  );
  returnData.collection = chooseBookData(
    googleBook.collection,
    openLibraryBook.collection,
    bnfBook.collection,
    1,
    2
  );
  return returnData;
};
