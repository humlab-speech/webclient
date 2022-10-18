const fs = require('fs');
process.chdir("dist");
fs.symlink("api/index.php", "index.php", "file", () => {
    console.log("Created symlink to index.php in api");
});
process.chdir("..");