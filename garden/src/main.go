package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/redis/go-redis/v9"
)

const (
	REDIS_URI      = "redis:6379"
	REDIS_PASSWORD = "mypassword"
	BROKER_URI     = "ws://broker:1883"
	clientId       = "garden"
	qos            = 1
)

const (
	TOPIC_STATUS = "garden/status"
	TOPIC_CONFIG = "garden/config"
)

type Sprinkler struct {
	Id        string       `json:"id"`
	Open      bool         `json:"open"`
	Pressure  float64      `json:"pressure"`
	X         float64      `json:"x"`
	Y         float64      `json:"y"`
	Direction int          `json:"direction"`
	Mx        sync.RWMutex `json:"-"`
}

type Garden struct {
	Time    time.Time             `json:"time"`
	Raining bool                  `json:"raining"`
	Status  map[string]*Sprinkler `json:"status"`
	Config  map[string]*Sprinkler `json:"config"`
}

var client mqtt.Client
var redisClient *redis.Client
var status Garden = Garden{
	Raining: false,
	Status:  make(map[string]*Sprinkler),
	Config:  make(map[string]*Sprinkler),
}
var statusMx sync.RWMutex = sync.RWMutex{}

// var f mqtt.MessageHandler = func(client mqtt.Client, msg mqtt.Message) {
// 	fmt.Printf("TOPIC: %s\n", msg.Topic())
// 	fmt.Printf("MSG: %s\n", msg.Payload())
// }

func main() {
	createSprinkler(Sprinkler{
		Id:        "a",
		Open:      true,
		Pressure:  0.5,
		X:         0,
		Y:         0,
		Direction: 135,
	})

	createSprinkler(Sprinkler{
		Id:        "b",
		Open:      false,
		Pressure:  0,
		X:         1,
		Y:         0,
		Direction: 225,
	})

	createSprinkler(Sprinkler{
		Id:        "c",
		Open:      true,
		Pressure:  1,
		X:         1,
		Y:         1,
		Direction: 315,
	})

	createSprinkler(Sprinkler{
		Id:        "d",
		Open:      false,
		Pressure:  0,
		X:         0,
		Y:         1,
		Direction: 45,
	})

	client = initMqtt()
	redisClient = initRedis()

	go startWeatherUpdater()
	go startStatusUpdater()
	go startStatusPublish()

	err := subscribeConfig(client)
	if err != nil {
		panic(err)
	}

	app := make(chan bool)
	<-app
}

func startWeatherUpdater() {
	redisClient.ConfigSet(context.TODO(), "notify-keyspace-events", "KEA")
	subscriber := redisClient.Subscribe(context.TODO(), "__keyspace@0__:weather")

	for {
		_, err := subscriber.ReceiveMessage(context.TODO())
		if err != nil {
			panic(err)
		}
		value, err := redisClient.Get(context.TODO(), "weather").Result()
		if err != nil {
			fmt.Printf("cannot check weather: %v\n", err)
			return
		}
		statusMx.Lock()
		status.Raining = (value == "rainy")
		statusMx.Unlock()
		fmt.Printf("weather is now: %v\n", value)
	}

	// ticker := time.NewTicker(3 * time.Second)
	// for {
	// 	<-ticker.C
	// 	value, err := redisClient.Get(context.TODO(), "weather").Result()
	// 	if err != nil {
	// 		fmt.Printf("cannot check weather: %v\n", err)
	// 		return
	// 	}
	// 	statusMx.Lock()
	// 	status.Raining = (value == "rainy")
	// 	statusMx.Unlock()
	// 	fmt.Printf("weather is now: %v\n", value)
	// }
}

func startStatusUpdater() {
	ticker := time.NewTicker(1 * time.Second)
	for {
		t := <-ticker.C
		statusMx.Lock()
		status.Time = t
		for id, cfg := range status.Config {
			sts := status.Status[id]
			sts.Mx.Lock()
			open := !status.Raining && cfg.Open
			pressure := cfg.Pressure
			if !open {
				pressure = 0
			}
			sts.Open = open
			p := sts.Pressure
			if p < pressure {
				sts.Pressure = math.Min(sts.Pressure+0.1, pressure)
			}
			if p > pressure {
				sts.Pressure = math.Max(pressure, sts.Pressure-0.1)
			}
			fmt.Printf("Sprinkler %v pressure %v / %v\n", id, sts.Pressure, pressure)
			d := sts.Direction
			if d < cfg.Direction {
				sts.Direction = sts.Direction + 10
				if sts.Direction > cfg.Direction {
					sts.Direction = cfg.Direction
				}
			}
			if d > cfg.Direction {
				sts.Direction = sts.Direction - 10
				if sts.Direction < cfg.Direction {
					sts.Direction = cfg.Direction
				}
			}
			sts.X = cfg.X
			sts.Y = cfg.Y
			sts.Mx.Unlock()
		}
		statusMx.Unlock()
	}
}

func startStatusPublish() {
	ticker := time.NewTicker(1 * time.Second)
	for {
		<-ticker.C
		statusMx.RLock()
		msg, err := json.Marshal(status)
		statusMx.RUnlock()
		if err != nil {
			mqtt.ERROR.Printf("Error on status marshal: %v", err)
			continue
		}
		publishStatus(client, msg)
	}
}

func createSprinkler(s Sprinkler) {
	// TODO: restore UUID
	// s.Id = uuid.New().String()
	status.Config[s.Id] = &s
	status.Status[s.Id] = &Sprinkler{
		Id: s.Id,
	}
}

func initRedis() *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     REDIS_URI,
		Password: REDIS_PASSWORD,
		DB:       0, // use default DB
	})
}

func initMqtt() mqtt.Client {
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
	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		panic(token.Error())
	}
	return client
}

func publishStatus(client mqtt.Client, msg []byte) {
	t := client.Publish(TOPIC_STATUS, qos, true, msg)
	go func() {
		_ = t.Wait() // Can also use '<-t.Done()' in releases > 1.2.0
		if t.Error() != nil {
			fmt.Printf("Error: %v\n", t.Error()) // Use your preferred logging technique (or just fmt.Printf)
		}
		// client.Disconnect(250)
	}()
}

func subscribeConfig(client mqtt.Client) (err error) {
	token := client.Subscribe(TOPIC_CONFIG, 0, func(c mqtt.Client, m mqtt.Message) {
		err := parseConfigMessage(m.Payload())
		if err != nil {
			fmt.Printf("cannot parse config: %v\n", err)
		}
	})
	token.Wait()
	return token.Error()
}

func getSprinklerForId(id string) (sprinkler *Sprinkler, err error) {
	statusMx.RLock()
	defer statusMx.RUnlock()
	sprinkler, ok := status.Config[id]
	if !ok {
		err = fmt.Errorf("sprinkler not found %v", id)
	}
	return sprinkler, err
}

func configSprinkler(config ConfigMessage) (err error) {
	sprinkler, err := getSprinklerForId(config.Id)
	if err != nil {
		createSprinkler(Sprinkler{
			Id:        config.Id,
			Open:      config.Open,
			Pressure:  config.Pressure,
			Direction: config.Direction,
			X:         config.X,
			Y:         config.Y,
		})
		fmt.Sprintf("create sprinkler config: %+v", sprinkler)
		return
	}
	sprinkler.Mx.Lock()
	defer sprinkler.Mx.Unlock()
	sprinkler.Open = config.Open
	sprinkler.Pressure = config.Pressure
	sprinkler.Direction = config.Direction
	sprinkler.X = config.X
	sprinkler.Y = config.Y
	fmt.Sprintf("new sprinkler config: %+v", sprinkler)
	return
}

type ConfigMessage struct {
	Id        string  `json:"id"`
	Open      bool    `json:"open"`
	Pressure  float64 `json:"pressure,omitempty"`
	X         float64 `json:"x,omitempty"`
	Y         float64 `json:"y,omitempty"`
	Direction int     `json:"direction,omitempty"`
}

func parseConfigMessage(msg []byte) (err error) {
	var cfg ConfigMessage
	err = json.Unmarshal(msg, &cfg)
	if err != nil {
		return
	}
	fmt.Printf("new config for %v: %+v\n", cfg.Id, cfg)
	return configSprinkler(cfg)
}
