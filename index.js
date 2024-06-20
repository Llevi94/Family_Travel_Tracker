import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 3000;

env.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  //ssl: true, // Render
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [];
let spellingError = false;
let newUserError = false;

//finds the countries linked to the current user by his ID
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

//return the users
async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows; // update the users arr
  return users.find((user) => user.id == currentUserId);
}

app.get("/new", async (req, res) => {
  res.render("new.ejs", {
    error: newUserError,
  });
});

//show the countries of the current user
app.get("/", async (req, res) => {
  const countries = await checkVisisted(); //get the current user countries
  const currentUser = await getCurrentUser(); //get the currnt user id, name, color
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users, //the users ARRAY data - name and color
    color: currentUser.color,
    error: spellingError,
  });
});

// add new country to the current user
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
      //incorrect spelling of country name
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
        //if the country has already been marked as visited
        console.log(err);
        res.redirect("/");
      }
    }
  } catch (err) {
    console.log(err);
  }
});

//get the ID of the selected user or open the new user page
app.post("/user", async (req, res) => {
  // if we click on the action="/user" in the ejs file (the top bar)
  if (req.body.add === "new") {
    //submit type in the ejs = if we click on the add place
    res.render("new.ejs", {
      error: newUserError,
    });
  } else {
    currentUserId = req.body.user; // in the ejs its name = user, and the value = id so we get the user id
    res.redirect("/");
  }
});

//create new user
app.post("/new", async (req, res) => {
  //new user
  const name = req.body.name;
  const color = req.body.color;


  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;", //returns the new user along with the automatically assigned ID
      [name, color]
    );
  
    const id = result.rows[0].id; //new user id
    currentUserId = id; //this is the current user to show after added
  
    res.redirect("/");
  } catch (err) {
    //if the user name already taken 
    console.log("IM HERE : " + err);
    newUserError = true;
    res.redirect("/new");
  }
  

  // const result = await db.query(
  //   "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;", //returns the new user along with the automatically assigned ID
  //   [name, color]
  // );

  // const id = result.rows[0].id; //new user id
  // currentUserId = id; //this is the current user to show after added

  // res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
