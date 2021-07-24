const mongoose = require("mongoose")

const database = async () =>{
    await mongoose.connect("" ,{
        useNewUrlParser : true ,
        useCreateIndex : true ,
        useUnifiedTopology : true ,
        useFindAndModify : false
    });
}

module.exports = database;
