import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port =  process.env.SERVER_PORT || 3000;

env.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: true, // Render
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [];
let spellingError = false;
let newUserError = false;

////Returns a list of countries marked by the current user by his ID
async function checkVisisted() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ", 
    [currentUserId]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

//Returns the selected user 
async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

//New user page
app.get("/new", async (req, res) => {
  res.render("new.ejs", {
    error: newUserError,
  });
});

//Main page
app.get("/", async (req, res) => {
  const countries = await checkVisisted(); //user countries
  const currentUser = await getCurrentUser(); //user id, name, color
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users, //the users ARRAY data - name and color
    color: currentUser.color,
    error: spellingError,
  });
});

//Adds a new country to the user's profile based on user input
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    //console.log("result: " + console.log(JSON.stringify(result)));

    if (result.rowCount == 0) {
      //Handles errors for incorrect country name input
      spellingError = true;
      res.redirect("/");
    } else {
      const data = result.rows[0];
      const countryCode = data.country_code;
      try {
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
          [countryCode, currentUserId]
        );
        spellingError = false;
        res.redirect("/");
      } catch (err) {
        //Handles errors for duplicate country addition
        console.log(err);
        res.redirect("/");
      }
    }
  } catch (err) {
    console.log(err);
  }
});

//Handles clicks on the top bar
app.post("/user", async (req, res) => {
  //new family member
  if (req.body.add === "new") {
    res.render("new.ejs", {
      error: newUserError,
    });
  } else {
    currentUserId = req.body.user; // current user id
    res.redirect("/");
  }
});

//Displays error if user exists, otherwise creates new user and returns ID (ADD btn)
app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;
  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;", //returns the new user along with the automatically assigned ID
      [name, color]
    );
    const id = result.rows[0].id; //new user id
    currentUserId = id;
  
    res.redirect("/");
  } catch (err) {
    //if the user name already taken 
    newUserError = true;
    res.redirect("/new");
  }
  
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
