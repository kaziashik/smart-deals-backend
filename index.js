const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config()
const jwt = require('jsonwebtoken');
const admin = require("firebase-admin");
const { getAuth } = require('firebase-admin/auth');

const { initializeApp, cert } = require('firebase-admin/app');
const decoded = Buffer.from(process.env.FIREBASE_SERVISE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

// console.log("chekc file", serviceAccount);


initializeApp({
    credential: cert(serviceAccount)
});

const port = process.env.PORT || 3000;




//middleware
app.use(cors());
app.use(express.json());



// my midelware

const logger = (req, res, next) => {
    // console.log('logging info',);
    next();
}


const verifyFireBaseToken = async (req, res, next) => {
    // console.log('in the verify middleware', req.headers.authorization);
    if (!req.headers.authorization) {
        return res.status(401).send({
            message: 'unauthorized access'
        });
    }
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send({
            message: 'unauthorized access'
        });
    }
    try {
        const decode_userInfo = await getAuth().verifyIdToken(token);;
        req.token_email = decode_userInfo.email;
        next();

    } catch (error) {
        return res.status(401).send({
            message: 'unauthorized access'
        });
    }
};



/*
// Jwt related apis

app.post('/getToken', (req, res) => {
    //  console.log("decoded token:", decoded);
    const loggedUser = req.body;

    const token = jwt.sign(
        { email: loggedUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    res.send({ token: token });
});
 */




//MongoClient

// console.log("user: ", process.env.DB_USER);
// console.log("password: ", process.env.DB_PASS);

// const uri = "mongodb+srv://user:password@cluster0.mx107ng.mongodb.net/?appName=Cluster0";
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mx107ng.mongodb.net/smart-deals?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



//API

app.get('/', (req, res) => {
    res.send(`smart server is runig on port ${port} `)
})

async function run() {
    try {
        await client.connect();
        const db = client.db('smart_db');
        const productCollection = db.collection('products');
        const bidsCollection = db.collection('bids');
        const usersCollection = db.collection('users');

        //users api
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const email = req.body.email;
            const query = { email: email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                res.send({ message: 'usre already exits. do not need to insert again' })
            }
            else {
                const result = await usersCollection.insertOne(newUser)
                res.send(result)
            }
        })


        // Products Api
        app.get('/products', async (req, res) => {
            try {
                // console.log(req.query);
                const email = req.query.email;
                const query = {}
                if (email) {
                    query.email = email
                }
                const cursor = productCollection.find(query);
                const result = await cursor.toArray();
                res.send(result)
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });


        app.get('/latest-products', async (req, res) => {
            const cursor = productCollection.find().sort({ created_at: -1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result)
        })


         app.get('/allProducts', async (req, res) => {
            const cursor = productCollection.find();
            const result = await cursor.toArray();
            res.send(result)
        })


        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.findOne(query);
            res.send(result);

        })


        app.post('/products', async (req, res) => {
            console.log('header in the post ', req.headers);
            try {
                const newProduct = req.body;
                const result = await productCollection.insertOne(newProduct);

                res.status(201).send(result);

            } catch (error) {
                res.status(500).send({
                    error: error.message
                });
            }
        });


        app.patch('/products/:id', async (req, res) => {

            const id = req.params.id;
            const updatedProduct = req.body;
            const query = { _id: new ObjectId(id) }
            const update = {
                $set: {
                    name: updatedProduct.name,
                    price: updatedProduct.price
                }
            }
            const result = await productCollection.updateOne(query, update)
            res.send(result)
        })


        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.deleteOne(query)
            res.send(result);
        });


        app.get('/products/bids/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = { product: productId }
            const cursor = bidsCollection.find(query).sort({ bid_price: -1 })
            const result = await cursor.toArray()
            res.send(result)
        })



        

        // Bids relatet APi

        app.get('/bids',verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;
            const query = {}
            if (email) {
                query.buyer_email = email;
            }
            //verify user have access to see this data
            if (email !== req.token_email) {
                return res.status(403).send({ message: "Forbetden access" })
            }
            const cursor = bidsCollection.find(query)
            const result = await cursor.toArray()
            res.send(result);
        })


        app.get('/bids/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await bidsCollection.findOne(query);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({
                    error: error.message
                });
            }
        });



        app.post('/bids', async (req, res) => {
            try {
                const newbids = req.body;
                const result = await bidsCollection.insertOne(newbids);
                res.status(201).send(result);

            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });



        app.patch('/bids/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updatedBid = req.body;
                const query = { _id: new ObjectId(id) };
                const update = {
                    $set: updatedBid
                };
                const result = await bidsCollection.updateOne(query, update);
                res.status(200).send(result);

            } catch (error) {
                res.status(500).send({
                    error: error.message
                });
            }
        });

        app.delete('/bids/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await bidsCollection.deleteOne(query);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({
                    error: error.message
                });
            }
        });






        // Connect the client to the server	
        await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    }
    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();

    }

}

run().catch(console.dir)
app.listen(port, () => {
    console.log(`smart server is runig on port ${port}`);

})

