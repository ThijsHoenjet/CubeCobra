const sanitizeHtml = require('sanitize-html');
const Cube = require('../models/cube');
const CardRating = require('../models/cardrating');
const util = require('./util');

function getCubeId(cube) {
  if (cube.urlAlias) return cube.urlAlias;
  if (cube.shortID) return cube.shortID;
  return cube._id;
}

function buildIdQuery(id) {
  if (!id || id.match(/^[0-9a-fA-F]{24}$/)) {
    return {
      _id: id,
    };
  }
  return {
    $or: [
      {
        shortID: id.toLowerCase(),
      },
      {
        urlAlias: id.toLowerCase(),
      },
    ],
  };
}

async function generateShortId() {
  const cubes = await Cube.find({}, ['shortID', 'urlAlias']);

  const shortIds = cubes.map((cube) => cube.shortID);
  const urlAliases = cubes.map((cube) => cube.urlAlias);

  const ids = cubes.map((cube) => util.fromBase36(cube.shortID));
  let max = Math.max(...ids);

  if (max < 0) {
    max = 0;
  }

  let newId = '';
  let isGoodId = false;
  while (!isGoodId) {
    max += 1;
    newId = util.toBase36(max);

    isGoodId = !util.hasProfanity(newId) && !shortIds.includes(newId) && !urlAliases.includes(newId);
  }

  return newId;
}

function intToLegality(val) {
  switch (val) {
    case 0:
      return 'Vintage';
    case 1:
      return 'Legacy';
    case 2:
      return 'Modern';
    case 3:
      return 'Pioneer';
    case 4:
      return 'Standard';
    default:
      return undefined;
  }
}

function legalityToInt(legality) {
  switch (legality) {
    case 'Vintage':
      return 0;
    case 'Legacy':
      return 1;
    case 'Modern':
      return 2;
    case 'Pioneer':
      return 3;
    case 'Standard':
      return 4;
    default:
      return undefined;
  }
}

function cardsAreEquivalent(card, details) {
  if (card.cardID !== details.cardID) {
    return false;
  }
  if (card.status !== details.status) {
    return false;
  }
  if (card.cmc !== details.cmc) {
    return false;
  }
  if (card.type_line && details.type_line && card.type_line !== details.type_line) {
    return false;
  }
  if (!util.arraysEqual(card.tags, details.tags)) {
    return false;
  }
  if (!util.arraysEqual(card.colors, details.colors)) {
    return false;
  }
  if (card.finish && details.finish && card.finish !== details.finish) {
    return false;
  }

  return true;
}

function cardHtml(card) {
  if (card.image_flip) {
    return `<a class="dynamic-autocard" card="${card.image_normal}" card_flip="${card.image_flip}">${card.name}</a>`;
  }
  return `<a class="dynamic-autocard" card="${card.image_normal}">${card.name}</a>`;
}

function addCardHtml(card) {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-success">+</span> ${cardHtml(
    card,
  )}<br/>`;
}

function removeCardHtml(card) {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-danger">-</span> ${cardHtml(
    card,
  )}<br/>`;
}

function replaceCardHtml(oldCard, newCard) {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-primary">→</span> ${cardHtml(
    oldCard,
  )} &gt; ${cardHtml(newCard)}<br/>`;
}

function abbreviate(name) {
  return name.length < 20 ? name : `${name.slice(0, 20)}…`;
}

function insertComment(comments, position, comment) {
  if (position.length <= 0) {
    comment.index = comments.length;
    comments.push(comment);
    return comment;
  }
  return insertComment(comments[position[0]].comments, position.slice(1), comment);
}

function getOwnerFromComment(comments, position) {
  if (position.length <= 0) {
    return '';
  }
  if (position.length === 1) {
    return comments[position[0]].owner;
  }
  return getOwnerFromComment(comments[position[0]].comments, position.slice(1));
}

function saveEdit(comments, position, comment) {
  if (position.length === 1) {
    comments[position[0]] = comment;
  } else if (position.length > 1) {
    saveEdit(comments[position[0]].comments, position.slice(1), comment);
  }
}

function buildTagColors(cube) {
  let { tag_colors: tagColor } = cube;
  const tags = tagColor.map((item) => item.tag);
  const notFound = tagColor.map((item) => item.tag);

  for (const card of cube.cards) {
    for (let tag of card.tags) {
      tag = tag.trim();
      if (!tags.includes(tag)) {
        tagColor.push({
          tag,
          color: null,
        });
        tags.push(tag);
      }
      if (notFound.includes(tag)) notFound.splice(notFound.indexOf(tag), 1);
    }
  }

  const tmp = [];
  for (const color of tagColor) {
    if (!notFound.includes(color.tag)) tmp.push(color);
  }
  tagColor = tmp;

  return tagColor;
}

function maybeCards(cube, carddb) {
  const maybe = (cube.maybe || []).filter((card) => card.cardID);
  return maybe.map((card) => ({ ...card, details: carddb.cardFromId(card.cardID) }));
}

async function getElo(cardnames, round) {
  const ratings = await CardRating.find({ name: { $in: cardnames } });
  const result = {};

  for (const cardname of cardnames) {
    result[cardname] = 1200; // default values
  }

  for (const rating of ratings) {
    result[rating.name] = round ? Math.round(rating.elo) : rating.elo;
  }

  return result;
}

/* 
Forked from https://github.com/lukechilds/merge-images
to support border radius for cards and width/height for custom card images.
*/
const generateSamplepackImage = (sources = [], options = {}) =>
  new Promise((resolve) => {
    const defaultOptions = {
      format: 'image/png',
      quality: 0.92,
      width: undefined,
      height: undefined,
      Canvas: undefined,
      crossOrigin: undefined,
    };

    options = { ...defaultOptions, ...options };

    // Setup browser/Node.js specific variables
    const canvas = options.Canvas ? new options.Canvas() : window.document.createElement('canvas');
    const { Image } = options.Canvas;

    // Load sources
    const images = sources.map(
      (source) =>
        // eslint-disable-next-line no-shadow
        new Promise((resolve, reject) => {
          // Convert sources to objects
          if (source.constructor.name !== 'Object') {
            source = { src: source };
          }

          // Resolve source and img when loaded
          const img = new Image();
          img.crossOrigin = options.crossOrigin;
          img.onerror = () => reject(new Error("Couldn't load image"));
          img.onload = () => resolve({ ...source, img });
          img.src = source.src;
        }),
    );

    // Get canvas context
    const ctx = canvas.getContext('2d');

    // When sources have loaded
    resolve(
      // eslint-disable-next-line no-shadow
      Promise.all(images).then((images) => {
        // Set canvas dimensions
        const getSize = (dim) => options[dim] || Math.max(...images.map((image) => image.img[dim]));
        canvas.width = getSize('width');
        canvas.height = getSize('height');

        // Draw images to canvas
        images.forEach((image) => {
          const scratchCanvas = options.Canvas ? new options.Canvas() : window.document.createElement('canvas');
          scratchCanvas.width = image.w || image.img.width;
          scratchCanvas.height = image.h || image.img.height;
          const scratchCtx = scratchCanvas.getContext('2d');
          scratchCtx.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);
          scratchCtx.globalCompositeOperation = 'source-over';

          const radiusX = image.rX || 0;
          const radiusY = image.rY || 0;
          const aspectRatio = image.img.width / image.img.height;

          let { width } = scratchCanvas;
          let height = width / aspectRatio;

          if (height > scratchCanvas.height) {
            height = scratchCanvas.height;
            width = height * aspectRatio;
          }

          const x = scratchCanvas.width / 2 - width / 2;
          const y = scratchCanvas.height / 2 - height / 2;

          scratchCtx.drawImage(image.img, x, y, width, height);

          scratchCtx.fillStyle = '#fff';
          scratchCtx.globalCompositeOperation = 'destination-in';
          scratchCtx.beginPath();
          scratchCtx.moveTo(x + radiusX, y);
          scratchCtx.lineTo(x + width - radiusX, y);
          scratchCtx.quadraticCurveTo(x + width, y, x + width, y + radiusY);
          scratchCtx.lineTo(x + width, y + height - radiusY);
          scratchCtx.quadraticCurveTo(x + width, y + height, x + width - radiusX, y + height);
          scratchCtx.lineTo(x + radiusX, y + height);
          scratchCtx.quadraticCurveTo(x, y + height, x, y + height - radiusY);
          scratchCtx.lineTo(x, y + radiusY);
          scratchCtx.quadraticCurveTo(x, y, x + radiusX, y);
          scratchCtx.closePath();
          scratchCtx.fill();

          ctx.globalAlpha = image.opacity ? image.opacity : 1;
          return ctx.drawImage(scratchCanvas, image.x || 0, image.y || 0);
        });

        if (options.Canvas && options.format === 'image/jpeg') {
          // Resolve data URI for node-canvas jpeg async
          // eslint-disable-next-line no-shadow
          return new Promise((resolve, reject) => {
            canvas.toDataURL(
              options.format,
              {
                quality: options.quality,
                progressive: false,
              },
              (err, jpeg) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(jpeg);
              },
            );
          });
        }

        // Resolve all other data URIs sync
        return canvas.toDataURL(options.format, options.quality);
      }),
    );
  });

function addTagsToCube(cubeTagColors, addedTags) {
  const updatedTagColors = cubeTagColors.map((tagColor) => {
    const i = addedTags.indexOf(tagColor.tag);
    if (i > -1) {
      addedTags.splice(i, 1);
      tagColor.referenceCountInCards += 1;
    }

    return {
      tag: tagColor.tag,
      color: tagColor.color,
      referenceCountInCards: tagColor.referenceCountInCards,
    };
  });

  const newTagColors = addedTags.map((newTag) => {
    return {
      tag: newTag,
      referenceCountInCards: 1,
    };
  });

  return [...updatedTagColors, ...newTagColors];
}

function removeTagsFromCube(cubeTagColors, removedTags) {
  return cubeTagColors
    .map((tagColor) => {
      if (removedTags.includes(tagColor.tag)) {
        tagColor.referenceCountInCards -= 1;
      }
      return tagColor;
    })
    .filter((tagColor) => {
      return tagColor.referenceCountInCards > 0;
    });
}

const methods = {
  getBasics(carddb) {
    const names = ['Plains', 'Mountain', 'Forest', 'Swamp', 'Island'];
    const set = 'unh';
    const res = {};
    for (const name of names) {
      let found = false;
      const options = carddb.nameToId[name.toLowerCase()];
      for (const option of options) {
        const card = carddb.cardFromId(option);
        if (!found && card.set.toLowerCase() === set) {
          found = true;
          res[name] = {
            cardID: option,
            type_line: card.type,
            cmc: 0,
            details: card,
          };
        }
      }
    }

    return res;
  },
  cardsAreEquivalent,
  setCubeType(cube, carddb) {
    let pauper = true;
    let type = legalityToInt('Standard');
    for (const card of cube.cards) {
      if (pauper && !carddb.cardFromId(card.cardID).legalities.Pauper) {
        pauper = false;
      }
      while (type > 0 && !carddb.cardFromId(card.cardID).legalities[intToLegality(type)]) {
        type -= 1;
      }
    }

    cube.type = intToLegality(type);
    if (pauper) {
      cube.type += ' Pauper';
    }
    cube.card_count = cube.cards.length;
    return cube;
  },
  sanitize(html) {
    return sanitizeHtml(html, {
      allowedTags: [
        'div',
        'p',
        'strike',
        'strong',
        'b',
        'i',
        'em',
        'u',
        'a',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'span',
        'br',
      ],
      selfClosing: ['br'],
    });
  },
  addAutocard(src, carddb, cube) {
    while (src.includes('[[') && src.includes(']]') && src.indexOf('[[') < src.indexOf(']]')) {
      const cardname = src.substring(src.indexOf('[[') + 2, src.indexOf(']]'));
      let mid = cardname;
      if (carddb.nameToId[cardname.toLowerCase()]) {
        const possible = carddb.nameToId[cardname.toLowerCase()];
        let cardID = null;
        if (cube && cube.cards) {
          const allIds = cube.cards.map((card) => card.cardID);
          const matchingNameIds = allIds.filter((id) => possible.includes(id));
          [cardID] = matchingNameIds;
        }
        if (!cardID) {
          [cardID] = possible;
        }
        const card = carddb.cardFromId(cardID);
        if (card.image_flip) {
          mid = `<a class="autocard" card="${card.image_normal}" card_flip="${card.image_flip}">${card.name}</a>`;
        } else {
          mid = `<a class="autocard" card="${card.image_normal}">${card.name}</a>`;
        }
      }
      // front + autocard + back
      src = src.substring(0, src.indexOf('[[')) + mid + src.substring(src.indexOf(']]') + 2);
    }
    return src;
  },
  generatePack: async (cubeId, carddb, seed) => {
    const cube = await Cube.findOne(buildIdQuery(cubeId));
    if (!seed) {
      seed = Date.now().toString();
    }

    const pack = util
      .shuffle(cube.cards, seed)
      .slice(0, 15)
      .map((card) => {
        card.details = carddb.getCardDetails(card);
        return card;
      });

    return {
      seed,
      pack,
    };
  },
  generateShortId,
  buildIdQuery,
  getCubeId,
  intToLegality,
  legalityToInt,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate,
  insertComment,
  getOwnerFromComment,
  saveEdit,
  buildTagColors,
  maybeCards,
  getElo,
  generateSamplepackImage,
  addTagsToCube,
  removeTagsFromCube,
};

module.exports = methods;
