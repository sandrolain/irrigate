package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

const (
	broker   = "ws://broker:1883"
	clientId = "garden"
	qos      = 0
)

const (
	TOPIC_STATUS = "garden/status"
)

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

var client mqtt.Client
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
	createSplinker(Sprinkler{
		Open:      true,
		Pressure:  0.5,
		X:         0,
		Y:         0,
		Direction: 135,
	})

	createSplinker(Sprinkler{
		Open:      false,
		Pressure:  0,
		X:         1,
		Y:         0,
		Direction: 225,
	})

	createSplinker(Sprinkler{
		Open:      true,
		Pressure:  1,
		X:         1,
		Y:         1,
		Direction: 315,
	})

	createSplinker(Sprinkler{
		Open:      false,
		Pressure:  0,
		X:         0,
		Y:         1,
		Direction: 45,
	})

	client = initMqtt()

	go startStatusUpdater()
	go startStatusPublish()

	app := make(chan bool)
	<-app
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
			fmt.Printf("Sprinkler %v pressure %v\n", id, sts.Pressure)
			d := sts.Direction
			if d < cfg.Direction {
				sts.Direction = sts.Direction + 5
				if sts.Direction > cfg.Direction {
					sts.Direction = cfg.Direction
				}
			}
			if d > cfg.Direction {
				sts.Direction = sts.Direction - 5
				if sts.Direction < cfg.Direction {
					sts.Direction = cfg.Direction
				}
			}
			sts.Mx.Unlock()
		}
		statusMx.Unlock()
	}
}

func startStatusPublish() {
	ticker := time.NewTicker(2 * time.Second)
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

func createSplinker(s Sprinkler) {
	s.Id = uuid.New().String()
	status.Config[s.Id] = &s
	status.Status[s.Id] = &Sprinkler{
		Id: s.Id,
	}
}

func initMqtt() mqtt.Client {
	mqtt.ERROR = log.New(os.Stdout, "[ERROR] ", 0)
	mqtt.CRITICAL = log.New(os.Stdout, "[CRIT] ", 0)
	mqtt.WARN = log.New(os.Stdout, "[WARN]  ", 0)
	mqtt.DEBUG = log.New(os.Stdout, "[DEBUG] ", 0)

	opts := mqtt.NewClientOptions()
	opts.AddBroker(broker)
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

func getSprinklerForId(id string) (*Sprinkler, error) {
	statusMx.RLock()
	defer statusMx.RUnlock()
	for _, s := range status.Config {
		if s.Id == id {
			return s, nil
		}
	}
	return nil, fmt.Errorf("sprinkler not found %v", id)
}

func configSprinkler(uuid string, config ConfigMessage) (err error) {
	sprinkler, err := getSprinklerForId(uuid)
	if err != nil {
		return
	}
	sprinkler.Mx.Lock()
	defer sprinkler.Mx.Unlock()
	sprinkler.Pressure = config.Pressure
	sprinkler.Direction = config.Direction
	sprinkler.X = config.X
	sprinkler.Y = config.Y
	return
}

type ConfigMessage struct {
	Pressure  float64 `json:"pressure,omitempty"`
	X         float64 `json:"x,omitempty"`
	Y         float64 `json:"y,omitempty"`
	Direction int     `json:"direction,omitempty"`
}

func parseMessage(uuid string, msg []byte) (err error) {
	var cfg ConfigMessage
	err = json.Unmarshal(msg, &cfg)
	if err != nil {
		return
	}
	return configSprinkler(uuid, cfg)
}
