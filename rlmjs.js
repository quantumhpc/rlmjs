/*
 * The MIT License (MIT)
 * 
 * Copyright (C) 2018 Quantum HPC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of 
 * this software and associated documentation files (the “Software”), to deal in the 
 * Software without restriction, including without limitation the rights to use, copy, 
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so, subject to the 
 * following conditions:

 * The above copyright notice and this permission notice shall be included in all 
 * copies or substantial portions of the Software.

 * The Software is provided “as is”, without warranty of any kind, express or implied, 
 * including but not limited to the warranties of merchantability, fitness for a particular 
 * purpose and noninfringement. In no event shall the authors or copyright holders be 
 * liable for any claim, damages or other liability, whether in an action of contract, 
 * tort or otherwise, arising from, out of or in connection with the software or the use 
 * or other dealings in the Software.
*/
var cproc = require('child_process');
var spawn = cproc.spawnSync;
var fs = require('fs');
var os = require('os');
var path = require('path');

// Regex for lmstat output
var featureRegEx=/^\s+([^:]+)\s(v[0-9]+\.[0-9]+)$/;
var countRegEx=/^\s+count\:\s*([0-9]+),\s*\#\s*reservations\:\s*([0-9]+),\s*inuse\:\s*([0-9]+),\s*exp\:\s*([a-z]+)/;
var totalRegEx=/^\s+obsolete\:\s*([0-9]+),\s*min_remove\:\s*([0-9]+),\s*total\scheckouts\:\s*([0-9]+)/;
var userTokenRegEx=/\s+([^:]+)\s(v[0-9]+\.[0-9]+)\:\s*(.+?)@([^\s]*)\s+([0-9]+)\/([0-9]+)\sat\s([0-9]+\/[0-9]+)\s([0-9]+:[0-9]+)/;

function rlmstat(rlmConfig, callback){
    var result = {};
    var tokenFeature, tokenVersion;
    var rlmCmd = rlmConfig.cmd.trim().split(/\s/g);
    
    // Create Stream
    var output = [];
    if (rlmConfig.serverURL[0] === 'test'){
        var outputFile = fs.readFileSync(rlmConfig.serverURL[1],'utf8');
        output.stdout = outputFile;
    }else{
        rlmCmd.push(rlmConfig.serverURL);
        output = spawn(path.resolve(rlmConfig.binary + (/^win/.test(process.platform) ? (!rlmConfig.binary.endsWith(".exe") ? '.exe' : '') : '')), rlmCmd, { encoding : 'utf8' });
    }
    
    // Invalid lmutil binary
    if (output.error){
      return callback(new Error(output.error));
    }
    // Transmit the error if any
    if (output.stderr){
      return callback(new Error(output.stderr.replace(new RegExp(os.EOL,'g'),"")));
    }
    // Treat output
    output = output.stdout.split(os.EOL);
    
    for (var i=0; i<output.length; i++){
        // Line by line
        var line = output[i];
        var m,n,o,p;
        // Feature line
        m = line.match(featureRegEx);
        if (m) {
            tokenFeature = m[1];
            tokenVersion = m[2];
            
            // Get next line
            var countLine = output[i+1];
            var totalLine = output[i+2];
            n = countLine.match(countRegEx);
            o = totalLine.match(totalRegEx);
            if (n && o) {
                // Push the feature
                result[tokenFeature] = {
                    "total"         :   n[1],
                    "reservations"  :   n[2],
                    "used"          :   n[3],
                    "free"          :   n[1]-n[3],
                    "version"       :   tokenVersion,
                    "obsolete"      :   o[1],
                    "min_remove"    :   o[2],
                    "checkouts"     :   o[3],
                    "tokens":[]
                };
                i+=2;
            }
        }else{
            p = line.match(userTokenRegEx);
            if (p) {
                // Push the token
                result[p[1]].tokens.push({
                    "username"      : p[3],
                    "machine"       : p[4],
                    "started"       : p[7] + " at " + p[8],
                    "version"       : p[2],
                    "tokens"        : p[5]
                  });
            }
        }
    }

    // Return result table
    return callback(null, result);
}

module.exports = {
    rlmstat :   rlmstat
};
