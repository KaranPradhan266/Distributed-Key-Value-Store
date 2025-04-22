const sprintf = require("sprintf").sprintf;
const Server = require("./server.js")

if (process.argv.length < 3) {
    console.log("Incorrect number of arguments; abort;")
    process.exit()
}

var port = parseInt(process.argv[2]), introducer;
if (port < 1) {
    console.log("Incorrect port number; abort;")
    process.exit()
}

if (process.argv.length > 3) {
    introducer = parseInt(process.argv[3])
    if (introducer < 1) {
        console.log("Incorrect introducer port number; abort;")
        process.exit()
    } else if (port == introducer) {
        console.log("port cannont be same as introducer; abort;")
        process.exit()
    }
}

console.log(
    sprintf("Process spawned with port: %d introducer: %s",
    port, (introducer) ? introducer : "NONE"));

var server = new Server(port, introducer)
