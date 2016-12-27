"use strict";
// trigger the debugger so that you can easily set breakpoints
debugger;

var StorageProvider = require("vectorwatch-storageprovider");
var VectorWatch = require('vectorwatch-sdk');

var vectorWatch = new VectorWatch();
var request = require("request");
var Schedule = require("node-schedule");
var logger = vectorWatch.logger;
var storageProvider = new StorageProvider();
vectorWatch.setStorageProvider(storageProvider);

vectorWatch.on("config", function(event, response) {
    // your stream was just dragged onto a watch face
    logger.info("on config");
    var apiKey = response.createAutocomplete("ApiKey");
	apiKey.setHint("Enter OpenWeather Api Key");
    apiKey.setDynamic(true);
    apiKey.setAsYouType(45);
    
    var cityName = response.createAutocomplete("City");
	cityName.setHint("Enter City, eg Minneapolis, MN");
    cityName.setDynamic(true);
    cityName.setAsYouType(45);
    
    var format = response.createGridList("format");
    format.addOption("C");
    format.addOption("F");
    
    response.send();
});

vectorWatch.on("options", function(event, response) {
    // dynamic options for a specific setting name was requested
    logger.info("on options");

});

vectorWatch.on('schedule', function(records) {
    logger.info('on schedule');

    records.forEach(function(record) {
        var settings = record.userSettings;
		getWeather(settings.City.name, settings.ApiKey.name).then(function(weatherPayload) {
			var currentConditions = parseWeatherData(weatherPayload, settings.format.name);
			record.pushUpdate(currentConditions);
			logger.info("Time Updated " + currentConditions);
		});
    });
});

vectorWatch.on("subscribe", function(event, response) {
    // your stream was added to a watch face
    logger.info("on subscribe");
    var apiKeyVal;
    var cityName;
    var format;
    try {
        apiKeyVal = event.getUserSettings().settings.ApiKey.name;
        cityName = event.getUserSettings().settings.City.name;
        format = event.getUserSettings().settings.format.name;
        getWeather(cityName, apiKeyVal).then(function(weatherPayload) {
            var currentConditions = parseWeatherData(weatherPayload, format);
            response.setValue(currentConditions);
            response.send();
        });
        logger.info("on subscribe: " + cityName);
    } catch(err) {
        logger.error("on subscribe - malformed user setting: " + err.message);
        cityName = "ERROR";
        response.send();
    }
});

vectorWatch.on("unsubscribe", function(event, response) {
    // your stream was removed from a watch face
    logger.info("on unsubscribe");
    response.send();
});

function getWeather(cityName, apiKey) {
    return new Promise(function (resolve, reject) {
        var weatherUrl = "http://api.openweathermap.org/data/2.5/weather";
        
        request({
            url: weatherUrl, //URL to hit
            qs: {q: cityName, appid: apiKey}, //Query string data
            method: "GET", //Specify the method
            headers: { //We can define headers too
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, sdch"
            }
        }, function(error, response, body){
            if(error) {
                console.log(error);
            } else {
                try {
                body = JSON.parse(body);
                if(body.cod == 200)
                {
                    resolve(body);
                }
            } catch(err) {
                reject("Malformed JSON response from " + weatherUrl + ': ' + err.message);
            }
            }
        });
    });
}
function parseWeatherData(rawData, format){
    var currentTemp = rawData.main.temp;
    var icons = "";
    for(var i =0; i< rawData.weather.length; i++)
    {
        var condition = rawData.weather[i].icon;
        var conditionId = rawData.weather[i].id;
        var icon = determineWeatherIcon(condition, conditionId);
        icons += icon;
        if(i === 1)
        {
            break;
        }
    }
    if(rawData.weather.length > 2)
    {
        icons += "...";
    }
    var convertedTemp = convertKtoTemp(currentTemp, format);
    return icons + " " + convertedTemp + "°" + format;
}
function convertKtoTemp(temp, format ){
    switch(format)
    {
        case "F":
            return Math.floor(((temp - 273.15) * 9/5) + 32);
        case "C":
            return Math.floor((temp-273.15));
    }
}
function determineWeatherIcon(condition, id){
//e004	Sunny
//e005	Clear night
//e006	Partly cloudy
//e007	Mostly cloudy
//e008	Cloudy
//e009	Foggy
//e00a	Windy
//e00b	Showers
//e00c	Freezing rain
//e00d	Freezing drizzle
//e00e	Mixed rain and snow
//e00f	Snow
//e010	Storm
//e011	Thunderstorm
// String.fromCharCode(0xe000)
    
    switch(id)
    {
        case 611:
            return String.fromCharCode(0xe00d);
        case 612:
            return String.fromCharCode(0xe00c);
        case 615:
        case 616:
            return String.fromCharCode(0xe00e);
        default: break;
            
    }
    switch(condition)
    {
        case "01d":
            return String.fromCharCode(0xe004);
        case "01n":
            return String.fromCharCode(0xe005);
        case "02d":
        case "02n":
            return String.fromCharCode(0xe006);
        case "03n":
        case "03d":
            return String.fromCharCode(0xe007);
        case "04d":
        case "04n":
            return String.fromCharCode(0xe008);
        case "09d":
        case "09n":
            return String.fromCharCode(0xe00b);
        case "10d":
        case "10n":
            return String.fromCharCode(0xe00b);
        case "11d":
        case "11n":
            return String.fromCharCode(0xe011);
        case "13d":
        case "13n":
            return String.fromCharCode(0xe00f);
        case "50d":
            return String.fromCharCode(0xe009);
        default:
            if(id == 905){
                return String.fromCharCode(0xe009);
            }
            else{
                return "";
            }
    }
}