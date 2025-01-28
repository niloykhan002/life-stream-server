require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fmfzj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("LifeStreamDB").collection("users");
    const blogsCollection = client.db("LifeStreamDB").collection("blogs");
    const donationRequestCollection = client
      .db("LifeStreamDB")
      .collection("donationRequests");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // verify volunteer
    const verifyVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isVolunteer = user?.role === "volunteer";
      if (!isVolunteer) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // Users api
    app.post("/users", async (req, res) => {
      const data = req.body;
      const result = await userCollection.insertOne(data);
      res.send(result);
    });
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const { status } = req.query;
      const query = {};
      if (status !== "all") {
        query.status = status;
      }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/users/volunteer/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let volunteer = false;
      if (user) {
        volunteer = user?.role === "volunteer";
      }
      res.send({ volunteer });
    });

    app.get("/users/donors", async (req, res) => {
      const { group, district, upazila } = req.query;
      const role = "donor";
      const query = {
        role: role,
      };
      if ((group, district, upazila)) {
        query.blood_group = group;
        query.district = district;
        query.upazila = upazila;
      }

      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/user", verifyToken, async (req, res) => {
      const { email } = req.query;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: updateInfo.name,
          email: updateInfo.email,
          image: updateInfo.image,
          blood_group: updateInfo.blood_group,
          district: updateInfo.district,
          upazila: updateInfo.upazila,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/all-users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { status, role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {},
      };
      if (status) {
        updateDoc.$set.status = status;
      }

      if (role) {
        updateDoc.$set.role = role;
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // donation requests api

    app.post("/donations", async (req, res) => {
      const data = req.body;
      const result = await donationRequestCollection.insertOne(data);
      res.send(result);
    });

    app.get("/donations/limit", verifyToken, async (req, res) => {
      const { email } = req.query;
      const query = { requester_email: email };
      const result = await donationRequestCollection
        .find(query)
        .limit(3)
        .toArray();

      res.send(result);
    });
    app.get("/donations", verifyToken, async (req, res) => {
      const { email, status } = req.query;
      const query = { requester_email: email };
      if (status !== "all") {
        query.donation_status = status;
      }
      const result = await donationRequestCollection.find(query).toArray();

      res.send(result);
    });
    app.get("/all-donations", verifyToken, verifyAdmin, async (req, res) => {
      const { status } = req.query;
      const query = {};
      if (status !== "all") {
        query.donation_status = status;
      }
      const result = await donationRequestCollection.find(query).toArray();
      res.send(result);
    });

    app.get(
      "/all-donations/volunteer",
      verifyToken,
      verifyVolunteer,
      async (req, res) => {
        const { status } = req.query;
        const query = {};
        if (status !== "all") {
          query.donation_status = status;
        }
        const result = await donationRequestCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.get("/all-pending", async (req, res) => {
      const status = "pending";
      const query = { donation_status: status };
      const result = await donationRequestCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/donations/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationRequestCollection.findOne(query);
      res.send(result);
    });

    app.patch("/donations/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          donation_status: updateInfo.donation_status,
        },
      };
      const result = await donationRequestCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });
    app.put("/donations/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          requester_name: updateInfo.requester_name,
          requester_email: updateInfo.requester_email,
          recipient_name: updateInfo.recipient_name,
          recipient_district: updateInfo.recipient_district,
          recipient_upazila: updateInfo.recipient_upazila,
          hospital_name: updateInfo.hospital_name,
          full_address: updateInfo.full_address,
          group: updateInfo.group,
          date: updateInfo.date,
          time: updateInfo.time,
          request_message: updateInfo.request_message,
          donation_status: updateInfo.donation_status,
        },
      };
      const result = await donationRequestCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.delete("/donations/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationRequestCollection.deleteOne(query);
      res.send(result);
    });

    // Blogs api
    app.post("/blogs", async (req, res) => {
      const data = req.body;
      const result = await blogsCollection.insertOne(data);
      res.send(result);
    });

    app.get("/blogs", async (req, res) => {
      const { blog_status } = req.query;
      const query = {};
      if (blog_status !== "all") {
        query.blog_status = blog_status;
      }
      const result = await blogsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await blogsCollection.findOne(filter);
      res.send(result);
    });

    app.patch("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          blog_status: updateInfo.blog_status,
        },
      };
      const result = await blogsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Life Stream is running");
});
app.listen(port, () => {
  console.log(`Life Stream is running on port ${port}`);
});
