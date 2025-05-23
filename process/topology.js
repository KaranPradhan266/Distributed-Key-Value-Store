// file has class and methods to deal with ring topology in cassandra
// like architecture

const express = require('express')
const sprintf = require('sprintf').sprintf;
const Membership = require('./membership.js')
const Datastore = require('./datastore.js')
const Kernel = require('./kernel.js')

// topology class
var Topology = function(app, port, introducer = null) {
    // REGION: Public variables
    this.app = app;
    this.port = port;
    this.datastore = new Datastore()
    this.maxReplicas = 3;                       // Max no of replica of a data
    this.quorumCount = 2;                       // Votes needed in Quorum

    // REGION: private variables ---------------------------------------------
    var $this = this;
    var id = Kernel.hashPort(this.port);        // self id
    var list = [id];                            // list of virtual IDS
    var listPortMapping = {};                   // mapping of id to port
    listPortMapping[id] = this.port;

    var stabilizationInProcess = false;         // stabilization state
    var stabilizationWaitTimeout = 1000;        // timeout for stabilization
    var stabilizationMethodTimeout = 5000;      // timeout for stabilization method, so that
                                                // it doesn't wait infinitely
    var stabilizationRetryLimit = 5;            // retry limit for stabilization wait;
    
    // REGION: Private methods ---------------------------------------------
    // sending stabilization message to all;
    var sendstabilizationMessage = (port, data, callback, retryCount = 0) => {
        if (retryCount > stabilizationRetryLimit) {
            console.log("Sendstabilization retry exceeded, port", port);
            if (callback) callback();
            return;
        }

        port = parseInt(port);
        if (port == $this.port) return callback();

        Kernel.send(
            parseInt(port),
            "d/stabilization",
            Kernel.RequestTypes.POST,
            { data: data },
            function(response, body) {
                callback();
            }, function(err) {
                sendstabilizationMessage(port, data, callback, retryCount + 1);
            }
        );
    }

    // Common stabilization method
    var stabilization = () => {
        list.sort(function(a, b) {
            return (a > b) ? 1 : -1;
        });

        var newIndex = list.indexOf(id);
        var stabalsiationMetadata = $this.datastore
            .getRemappedData(newIndex, list.length, $this.maxReplicas);
        
        if (Object.keys(stabalsiationMetadata).length == 0) {
            stabilizationInProcess = false;
            return;
        }

        var stabalised = 0;
        Object.keys(stabalsiationMetadata).forEach((_id) => {
            var port = listPortMapping[list[_id]];
            sendstabilizationMessage(port, stabalsiationMetadata[_id], () => {
                ++stabalised;
                if (stabalised >= Object.keys(stabalsiationMetadata).length) {
                    stabilizationInProcess = false;
                    $this.datastore.removeStabalsiedKeys(newIndex, list.length, $this.maxReplicas);
                }
            });
        });
    }

    // stabilization to perform when a new member joins
    var joinstabilization = (joinPort, retryCount = 0) => {
        if (retryCount > stabilizationRetryLimit) {
            // not harmful as it sounds
            console.log("retry limit for stabilization; port:", joinPort)
            return;
        }

        if (stabilizationInProcess) {
            setTimeout(function() {
                joinstabilization(joinPort, retryCount + 1)
            }, stabilizationWaitTimeout);
            return;
        }

        stabilizationInProcess = true;
        console.log("[SIN] stabilization (+ve): ", joinPort)
        var joinPortId = Kernel.hashPort(joinPort);
        listPortMapping[joinPortId] = joinPort;

        if (list.indexOf(joinPortId) != -1) {
            console.log("[SOUT] stabilization_HALT, already in: ", joinPort, joinPortId);
            stabilizationInProcess = false;
            return;
        }

        // add to list
        list.push(joinPortId);
        stabilization();
    }

    // statbalisation to perform when an old member leaves
    var churnstabilization = (chrunPort, retryCount = 0) => {
        if (retryCount > stabilizationRetryLimit) {
            // Not harmful as it sounds
            console.log("retry limit for stabilization; port:", chrunPort)
            return;
        }

        if (stabilizationInProcess) {
            setTimeout(() => {
                churnstabilization(chrunPort, retryCount + 1)
            }, stabilizationWaitTimeout);
            return;
        }

        stabilizationInProcess = true;
        console.log("[SIN] stabilization (-ve): ", chrunPort)
        var chrunPortId = Kernel.hashPort(chrunPort);

        if (list.indexOf(chrunPortId) == -1) {
            console.log(
                "[SOUT] stabilization_HALT, already not in: ",
                chrunPort,
                chrunPortId);
            stabilizationInProcess = false;
            return;
        }

        // remove this from list
        const index = list.indexOf(chrunPortId);
        list.splice(index, 1);
        stabilization();
    }
    
    // REGION: Constuctor code ---------------------------------------------
    this.membership = new Membership(app, port, joinstabilization, churnstabilization);
    if (introducer) {
        this.membership.sendJoinReq(introducer);
    }

    // Initialize the internal apis  --------
    // READ API
    this.app.get('/d/read', (req, res) => {
        var key = req.query.key;
        if (process.env.NODE_ENV !== Kernel.Constants.TestEnv)
            console.log(sprintf("dREAD: %s", key));

        if (!key) {
            res.status(400).send('Key missing in query');
        } else {
            res.json({value: $this.datastore.get(key)});
        }
    })

    // READ REPAIR API
    this.app.post('/d/readrepair', (req, res) => {
        var data = req.body.data;
        if (process.env.NODE_ENV != Kernel.Constants.TestEnv)
            console.log(sprintf("dREADREPAIR: %s", data.key));

        if (!data || !data.key || !data.value) {
            return res.status(400).send('Key missing; bad request');
        }

        data.value.timestamp = parseInt(data.value.timestamp);

        if (!$this.datastore.has(data.key)) {
            return res.status(400).send('key not found');
        } else if ($this.datastore.get(data.key).timestamp < data.value.timestamp) {
            $this.datastore.set(data.key, data.value.value, data.value.timestamp);
        }
        res.json({ack: true});
    })

    // WRITE API
    this.app.post('/d/write', (req, res) => {
        var key = req.body.key;
        var value = req.body.value;
        var timestamp = req.body.timestamp;

        if (!key || !value || !timestamp) {
            return res.status(400).send("Key, Value or Timestamp missing");
        }

        if (process.env.NODE_ENV != Kernel.Constants.TestEnv)
            console.log(sprintf("dWRITE: %s, val: %s", key, value));

        try {
            $this.datastore.set(key, value, timestamp);
        } catch (ex) {
            console.log(ex);
        }
        res.json({ack: true});
    });

    // DELETE API
    this.app.delete('/d/delete', (req, res) => {
        var key = req.query.key;
 
        if (process.env.NODE_ENV != Kernel.Constants.TestEnv)
            console.log(sprintf("dDELETE: %s", key));
        
        if (!key) {
            res.status(400).send('Key missing in query');
        } else {
             try {
                $this.datastore.delete(key);
                res.json({ack: true})
            }
            catch (ex) {
                console.log("Key delete error; " +ex.message);
                res.status(400).send('Key missing in query');
            }
        }
    });

    // stabilization API
    this.app.post('/d/stabilization', (req, res) => {
        var data = req.body.data;

        if (process.env.NODE_ENV != Kernel.Constants.TestEnv) {
            console.log("dstabilization: Count", data.length);
        }

        if (data && data.length) {
            data.forEach(function(d) {
                try {
                    $this.datastore.set(d.key, d.value.value, d.value.timestamp);
                } catch (ex) {
                    // expected; its ok
                }
            });
            res.json({ack: true});
        } else {
            console.log('undefined or empty payload');
            res.json({ack: true, error: 'undefined or empty payload'})
        }

    });
    
    // ----------------------------------------------------------------
    // REGION: public methods that shall use private variables
    // check what can be taken out of it;
    
    // Method to get the key
    this.get = (key, callback, retryCount = 0) => {
        if (!key || !callback) {
            throw Error("ArgumentException")
        }

        // set a timeout and maybe fail with 5xx error if it 
        // doesn't finish before that;
        var indexes = Kernel.hashKey(key, list.length, this.maxReplicas);
        var responses = [];

        var responseCallback = () => {
            if (responses.length != indexes.length) return;

            // look at +ve responses, count and get val;
            var val = null, positiveCount = 0;
            responses.forEach((response) => {
                if (response != null && response.value != null) {
                    ++positiveCount;
                    if (val) {
                        if (response.value.timestamp > val.value.timestamp) {
                            if (response.value.value != val.value.value) {
                                // send a read-repair to by
                                Kernel.send(
                                    val.by,
                                    "d/readrepair",
                                    Kernel.RequestTypes.POST,
                                    { data: {key: key, value: val.value} },
                                    function(response, body) {
                                        // console.log(body);
                                    }, function(err) {
                                        console.log(err);
                                    }
                                );
                            }
                            val = response;
                        }
                    } else {
                        val = response;
                    }
                }
            });

            if (indexes.length < $this.quorumCount) {
                if (positiveCount !== indexes.length) callback(null);
                else callback(val.value);
            } else if (positiveCount < $this.quorumCount) {
                callback(null);
            } else {
                callback(val.value);
            }
        }

        indexes.forEach((index) => {
            var port = listPortMapping[list[index]];
            if (port == $this.port) {
                responses.push({
                    value: $this.datastore.get(key),
                    by: port
                });
                responseCallback();
            } else {
                // send request to port
                Kernel.send(
                    port,
                    "d/read",
                    Kernel.RequestTypes.GET,
                    sprintf("key=%s", key),
                    function(resp, body) {
                        try {
                            responses.push({
                                value: JSON.parse(body).value,
                                by: port
                            });
                        } catch (ex) {
                            responses.push(null);
                        }
                        responseCallback();
                    }, function(err) {
                        responses.push(null);
                        responseCallback();
                    }
                );
            }
        });
    }

    // Method to set the key
    this.set = (key, value, callback, retryCount = 0) => {
        if (!key || !value || !callback) {
            throw Error("ArgumentException");
        }

        var indexes = Kernel.hashKey(key, list.length, this.maxReplicas);
        var responses = [];

        var responseCallback = function() {
            if (responses.length != indexes.length) return;
            var positiveCount = 0;
            responses.forEach(function(response) {
                if (response) positiveCount++;
            });

            if (indexes.length < $this.quorumCount) {
                if (positiveCount != indexes.length) {
                    callback(Error('Unable to write to quorum'));
                } else callback(null);
            } else if (positiveCount < $this.quorumCount) {
                callback(Error('Unable to write to quorum'));
            } else callback(null);
        }

        indexes.forEach(function(index) {
            var port = listPortMapping[list[index]];
            if (port == $this.port) {
                $this.datastore.set(key, value);
                responses.push(true);
                responseCallback();
            } else {
                // send request to port
                Kernel.send(
                    port,
                    "d/write",
                    "POST",
                    {key: key, value: value, timestamp: Kernel.getTimestamp()},
                    function(resp, body) {
                        responses.push(true);
                        responseCallback();
                    }, function(err) {
                        responses.push(false);
                        responseCallback();
                    }
                );
            }
        });
    }

    // Method to delete a key
    this.delete = (key, callback, retryCount = 0) => {
        if (!key || !callback) {
            throw Error("ArgumentException")
        }

        var indexes = Kernel.hashKey(key, list.length, this.maxReplicas);
        var responses = [];

        var responseCallback = () => {
            if (responses.length != indexes.length) return;
            var positiveCount = 0;
            responses.forEach((response) => {
                if (response) positiveCount++;
            });

            if (indexes.length < $this.quorumCount) {
                if (positiveCount != indexes.length) {
                    callback(Error('Unable to delete from quorum'));
                } else callback(null);
            } else if (positiveCount < $this.quorumCount) {
                callback(Error('Unable to delete from quorum'));
            } else callback(null);
        }

        indexes.forEach((index) => {
            var port = listPortMapping[list[index]];
            if (port == $this.port) {
                try {
                    $this.datastore.delete(key);
                    responses.push(true);
                } catch (ex) {
                    console.log("EX while self delete; ", ex.message)
                    responses.push(false);
                }
                responseCallback();
            } else {
                // send request to port
                Kernel.send(
                    port,
                    "d/delete",
                    Kernel.RequestTypes.DELETE,
                    "key=" +key,
                    function(resp, body) {
                        responses.push(true);
                        responseCallback();
                    }, function(err) {
                        responses.push(false);
                        responseCallback();
                    }
                );
            }
        });
    }
}

module.exports = Topology;