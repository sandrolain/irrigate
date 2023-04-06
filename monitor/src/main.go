package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	MONGODB_URI        = "mongodb://root:mypassword@mongodb:27017/monitor?authSource=admin"
	MONGODB_DATABASE   = "monitor"
	MONGODB_COLLECTION = "status"
	BROKER_URI         = "ws://broker:1883"
	clientId           = "monitor"
	qos                = 0
)

const (
	TOPIC_STATUS = "garden/status"
)

var mqttClient mqtt.Client
var mongoClient *mongo.Client
var mongoColl *mongo.Collection

type Sprinkler struct {
	Id        string  `json:"id"`
	Open      bool    `json:"open"`
	Pressure  float64 `json:"pressure"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Direction int     `json:"direction"`
	Mx        sync.RWMutex
}

type Garden struct {
	Time    time.Time             `json:"time"`
	Raining bool                  `json:"raining"`
	Status  map[string]*Sprinkler `json:"status"`
	Config  map[string]*Sprinkler `json:"config"`
}

func main() {
	initMongo()
	initMqtt()
	err := subscribeConfig()
	if err != nil {
		panic(err)
	}

	app := make(chan bool)
	<-app
}

func initMongo() {
	var err error
	mongoClient, err = mongo.Connect(context.TODO(), options.Client().ApplyURI(MONGODB_URI))
	if err != nil {
		panic(err)
	}

	mongoColl = mongoClient.Database(MONGODB_DATABASE).Collection(MONGODB_COLLECTION)
	mongoColl.Indexes().CreateOne(context.TODO(), mongo.IndexModel{
		Keys: bson.D{{"time", 1}},
	})
}

func initMqtt() {
	mqtt.ERROR = log.New(os.Stdout, "[ERROR] ", 0)
	mqtt.CRITICAL = log.New(os.Stdout, "[CRIT] ", 0)
	mqtt.WARN = log.New(os.Stdout, "[WARN]  ", 0)
	//mqtt.DEBUG = log.New(os.Stdout, "[DEBUG] ", 0)

	opts := mqtt.NewClientOptions()
	opts.AddBroker(BROKER_URI)
	opts.SetClientID(clientId)
	opts.SetKeepAlive(2 * time.Second)
	// opts.SetDefaultPublishHandler(f)
	opts.SetPingTimeout(1 * time.Second)
	// opts.SetUsername(*user)
	// opts.SetPassword(*password)
	opts.SetCleanSession(false)
	// if *store != ":memory:" {
	// 	opts.SetStore(MQTT.NewFileStore(*store))
	// }
	mqttClient = mqtt.NewClient(opts)
	if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
		panic(token.Error())
	}
}

func subscribeConfig() (err error) {
	token := mqttClient.Subscribe(TOPIC_STATUS, 0, func(c mqtt.Client, m mqtt.Message) {
		err := parseStatusMessage(m.Payload())
		if err != nil {
			fmt.Printf("cannot parse status: %v\n", err)
		}
	})
	token.Wait()
	return token.Error()
}

func parseStatusMessage(msg []byte) (err error) {
	var status Garden
	err = json.Unmarshal(msg, &status)
	if err != nil {
		return
	}
	fmt.Printf("status received: %v\n", status)
	res, err := mongoColl.InsertOne(context.TODO(), status)
	if err != nil {
		return
	}
	fmt.Printf("inserted: %v\n", res.InsertedID)

	return
}
