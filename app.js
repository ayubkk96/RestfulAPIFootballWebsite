/**Import modules */
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const app = express();
const url = require("url");
const mysql = require('mysql');
const bodyParser = require('body-parser');

/** Status codes */
require('./http_status');

/** Connection object with the user details */
const connectionPool = mysql.createPool({
  connectionLimit: 5,
  host: "localhost",
  user: "root",
  password: "",
  database: "footballdatabase",
  debug:false
});

/** Set up the application to handle GET requests sent to the user path */
app.get('/teams/*', handleGetRequest);//Subfolders
app.get('/teams', handleGetRequest);

/** Start the app listening on port 8080 */
app.listen(8080);
function handleGetRequest(request, response) {
  //Parse the URL
  const urlObj = url.parse(request.url, true);

  //Extract object containing queries from URL object.
  const queries = urlObj.query;

  //Get the pagination properties if they have been set. Will be  undefined if not set.
  const numItems = queries['num_items'];
  const offset = queries['offset'];

  //Split the path of the request into its components
  const pathArray = urlObj.pathname.split("/");

  //Get the last part of the path
  const pathEnd = pathArray[pathArray.length - 1];

  //If path ends with 'cheese' we return all cheeses
  if(pathEnd === 'teams'){
    getTotalTeamsCount(response, numItems, offset);//This function calls the getAllCheeses function in its callback
    return;
  }

  //If path ends with cheese/, we return all cheeses
  if (pathEnd === '' && pathArray[pathArray.length - 2] === 'cheese'){
    getTotalTeamsCount(response, numItems, offset);//This function calls the getAllCheeses function in its callback
    return;
  }

  //If the last part of the path is a valid user id, return data about that user
  const regEx = new RegExp('^[0-9]+$');//RegEx returns true if string is all digits.
  if(regEx.test(pathEnd)){
    getTeams(response, pathEnd);
    return;
  }

  //The path is not recognized. Return an error message
  response.status(HTTP_STATUS.NOT_FOUND);
  response.send("{error: 'Path not recognized', url: " + request.url + "}");
}

/** Returns all of the teams, possibly with a limit on the total number of items returned and the offset (to
 *  enable pagination). This function should be called in the callback of getTotalTeamsCount  */
function getAllTeams(response, totNumItems, numItems, offset){
  //Select the cheese data using JOIN to convert foreign keys into useful data.
  let sql = "SELECT football.id, football.team_name, football.stadium, football.next_game, football.team_url FROM football";

  //Limit the number of results returned, if this has been specified in the query string
  if(numItems !== undefined && offset !== undefined ){
    sql += "ORDER BY football.id LIMIT " + numItems + " OFFSET " + offset;
  }

  //Execute the query
  connectionPool.query(sql, function (err, result) {

    //Check for errors
    if (err){
      //Not an ideal error code, but we don't know what has gone wrong.
      response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      response.json({'error': true, 'message': + err});
      console.log("GET cheese error: " + err);
      return;
    }

    //Create JavaScript object that combines total number of items with data
    const returnObj = {totNumItems: totNumItems};
    returnObj.data = result; //Array of data from database

    //Return results in JSON format
    response.json(returnObj);
  });
}
/** When retrieving all cheeses we start by retrieving the total number of cereals
 The database callback function will then call the function to get the cereal data
 with pagination */
function getTotalTeamsCount(response, numItems, offset){
  const sql = "SELECT COUNT(*) FROM football";

  //Execute the query and call the anonymous callback function.
  connectionPool.query(sql, function (err, result) {

    //Check for errors
    if (err){
      //Not an ideal error code, but we don't know what has gone wrong.
      response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      response.json({'error': true, 'message': + err});
      return;
    }

    //Get the total number of items from the result
    const totNumItems = result[0]['COUNT(*)'];

    //Call the function that retrieves all cheeses
    getAllTeams(response, totNumItems, numItems, offset);
  });
}

/** Returns the cheese with the specified ID */
function getTeams(response, id){
  //Build SQL query to select the cheese with a specified id.
  let sql = "SELECT football.id, football.team_name, football.stadium, football.next_game, football.team_url FROM football " +
      "WHERE football.id=" + id;

  //Execute the query
  connectionPool.query(sql, function (err, result) {

    //Check for errors
    if (err){
      //Not an ideal error code, but we don't know what has gone wrong.
      response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      response.json({'error': true, 'message': + err});
      return;
    }

    //Output results in JSON format
    response.json(result);
  });
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
