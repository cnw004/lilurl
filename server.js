const express = require('express');
const Ajv = require('ajv');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const monk = require('monk');
const bodyParser = require('body-parser');
const { nanoid } = require('nanoid');
require('dotenv').config();

const port = process.env.PORT || 8080

const app = express();
app.use(bodyParser.json());
app.use(express.static('./public'));
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
		id: {
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
const db = monk(process.env.MONGODB_URI);
db.catch(function(err) {
  console.log(err)
});
const urls = db.get('urls');
urls.createIndex({id: 1}, {unique: true});



// --------------------------------------
// set up all the endpts
// --------------------------------------
// TODO: server static stuff from /
app.get('/', (_, res) => res.send('Hello World!'));
app.get('/:id', async (req, res, next) => {
	const id = req.params.id;
	try {
		const { url } = await urls.findOne({ id });
		if (url) {
			res.redirect(url);
		} else {
			res.redirect(`/?error=${id} not found`);
		}
	} catch(error) {
		res.redirect('/?error=Link not found');
	}
});


// GET url from a id
// mostly for debugging / testing purposes
// I will probably remove this endpt
app.get('/api/url/:id', async (req, res, next) => {
	const id = req.params.id;
	console.log(`GET to /api/url/:id with id ${id}`)
	try {
		const { url } = await urls.findOne({ id });
		if (url) {
			res.json({"url": url});
		} else {
			throw new Error(`No URL for id ${id}`);
		}
	} catch(error) {
		next(error);
	}
});

// POST a short url mapping
// body here follows the shema above
app.post('/api/url', async (req, res, next) => {
	let { id, url } = req.body;
	console.log(`POST to /api/url with id: ${id} and url: ${url}`);
	try {
		validate(req.body) // validate request against schema
		if (!id) {
			id = nanoid(5); // user doesnt set a id, create a random one
		} 
		// TODO: dont assume that generated ids are going to be unique
		id = id.toLowerCase();
		const created = await urls.insert({
			url,
			id,
		});
		res.json({ created })
	} catch(error) {
		if (error.message.startsWith('E11000')) {
			error.message = `id ${id} in use.`
		}
		next(error);
	}
});

// DELETE a url mapping
app.delete('/api/url/:id', async (req, res, next) => {
	// TODO: write function to delete a mapping
	const id = req.params.id;
	try {
		const removed = await urls.remove({"id": id});
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

