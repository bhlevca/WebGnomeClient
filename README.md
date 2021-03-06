WebGnomeClient
==============
[![build status](https://ci.orr.noaa.gov/projects/2/status.png?ref=master)](https://ci.orr.noaa.gov/projects/2?ref=master)

Javascript client that uses the WebGnomeAPI to create and run py_gnome models. Instructions on how to setup a WebgnomeAPI server and OilLibraryAPI server can be found here [API Setup](API_SETUP.md)

## Application Requirements
* [WebGnomeAPI Server](https://gitlab.orr.noaa.gov/gnome/webgnomeapi.git)
* [OilLibraryAPI Server](https://gitlab.orr.noaa.gov/gnome/oillibraryapi.git)

## System Requirments
* [Node.js](http://nodejs.org/)
* [npm](http://www.npmjs.org/)
* grunt-cli
* Some form of http server, webroot set to `./dist/build` and directory index set to `build.html` (created after running `grunt build`)

## Setup Instructions
Install Node.js for your platform. Windows users go to [Node.js download page](http://nodejs.org/en/download)  
Run the following command to install the yarn npm manager:  
`npm install -g yarn`

From the webgnomeclient repository root, run the following to install all dependencies:  
`yarn install`

To update dependencies if necessary, run `yarn install` again. 

Use `grunt develop` for active development.  

## Commands
`yarn install`
> Installs all of the applications dependencies described in `package.json`.

`grunt develop`
> Alias for `grunt less:compile connect:start watch:css`. Sets up a working development environment by compiling less files, starting a http server, and setting up a watch task for the less to recompile on change.


`grunt build`
> Builds a compiled version of the application into a single index.html file (marginally supported currently, still has a few external image and font dependancies that are relatively pathed) located in `./dist/build/`.

`grunt build:lite`
> Simpler version of `grunt build`, sets up the applcation for requirejs based dynamic builds.

`grunt serve`
> Starts a http server on port 8080 for serving dynamic builds.

`grunt docs`
> Generate JSDoc based documentation. Located in `./dist/docs`.

`grunt lint`
> Runs jshint over application source files

`grunt test`
> Runs jshint over application source files, followed by a series of selenium tests. (Only works if you have a working client on your system running at `http://localhost:8080`).

`grunt test:demos`
> Similar to `grunt test` but only runs use case specific demo tests.

## Running the Client

This set of commands will set up and run teh whole thing (from the CI configuration)


`RUN cd /webgnomeclient && npm install && npm install -g grunt`

Installs the needed npm packages listed in package.json and installs the grunt package globally so that it can be used as a command (something that can't be done with the local dependency list in package.json)

`RUN cd /webgnomeclient && grunt install`

Runs the grunt install command that's configured in gruntfile.js

`RUN cp /webgnomeclient/config-example.json /config/config.json`

Copies the example config file to the config directory and renames it. /config is noted as a docker volume so that when running the container you can provide your own config instead if the default isn't what you want.

`RUN ln -s /config/config.json /webgnomeclient/config.json`

This symlink is so that the replaceable (through a docker volume) config file can be used by the application.

