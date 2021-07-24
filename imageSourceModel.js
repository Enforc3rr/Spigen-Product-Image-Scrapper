const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    sku : {
        type : String ,
        unique : true
    },
    src : {
        type : Array ,
        imgLink : String
    }
});


module.exports = mongoose.model("imgSrc",schema);