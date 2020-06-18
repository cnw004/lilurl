const express = require('express');
const Ajv = require('ajv');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const monk = require('monk');
const { nanoid } = require('nanoid');
require('dotenv').config();

const port = process.env.PORT || 8080

const app = express();
app.use(express.json());
//app.use(express.static('./public'));
app.use(morgan('tiny'));
app.use(helmet());
app.use(cors());


// --------------------------------------------
// configure the schema for /url post endpoint
// --------------------------------------------
const ajv = new Ajv({allErrors:true})
const schema = {
	type: 'object',
	required: ['url'],
	properties: {
		url: {
			description: "must be URL format",
			type: ["string"],
			format: "url",
		},
		slug: {
			descrition: "any string of letters/chars separated by - or _",
			type: ["string", "integer"],
			pattern: "^[a-zA-Z0-9_\-]*$",
		},
	},
	additionalProperties: false,
}
var validate = ajv.compile(schema);


// --------------------------------------
// configure mongodb connection
// --------------------------------------
const db = monk(process.env.MONGO_URI);
db.catch(function(err) {
  console.log(err)
});
const urls = db.get('urls');
urls.createIndex({slug: 1}, {unique: true});



// --------------------------------------
// set up all the endpts
// --------------------------------------
// TODO: server static stuff from /
app.get('/', (_, res) => res.send('Hello World!'));
app.get('/:slug', async (req, res, next) => {
	const slug = req.params.slug;
	try {
		const { url } = await urls.findOne({ slug });
		if (url) {
			res.redirect(url);
		} else {
			res.redirect(`/?error=${slug} not found`);
		}
	} catch(error) {
		res.redirect('/?error=Link not found');
	}
});


// GET url from a slug
// mostly for debugging / testing purposes
// I will probably remove this endpt
app.get('/api/url/:slug', async (req, res, next) => {
	const slug = req.params.slug;
	console.log(`GET to /api/url/:slug with slug ${slug}`)
	try {
		const { url } = await urls.findOne({ slug });
		if (url) {
			res.json({"url": url});
		} else {
			throw new Error(`No URL for slug ${slug}`);
		}
	} catch(error) {
		next(error);
	}
});

// POST a short url mapping
// body here follows the shema above
app.post('/api/url', async (req, res, next) => {
	let { slug, url } = req.body;
	console.log(`POST to /api/url with slug: ${slug} and url: ${url}`);
	try {
		validate(req.body) // validate request against schema
		if (!slug) {
			slug = nanoid(5); // user doesnt set a slug, create a random one
		} 
		// TODO: dont assume that generated slugs are going to be unique
		slug = slug.toLowerCase();
		const created = await urls.insert({
			url,
			slug,
		});
		res.json(created)
	} catch(error) {
		if (error.message.startsWith('E11000')) {
			error.message = `Slug ${slug} in use.`
		}
		next(error);
	}
});

// DELETE a url mapping
app.delete('/api/url/:slug', async (req, res, next) => {
	// TODO: write function to delete a mapping
	const slug = req.params.slug;
	try {
		const removed = await urls.remove({"slug": slug});
		res.json(removed);
	} catch(error) {
		next(error);
	}
});

// GET all url mappings
app.get('/api/urls', async (req, res, next) => {
	try {
		// get mappings, exclude mongo _id from result
		const mappings = await urls.find({}, {projection: { _id: 0 }});
		res.json(mappings);
	} catch(error) {
		next(error);
	}
});


app.use((error, req, res, next) => {
	if (error.status) {
		res.status(error.status);
	}
	res.json({
		message: error.message,
		stack: process.env.NODE_ENV === 'production' ? "STACK TRACE" : error.stack,
	})
})
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));

