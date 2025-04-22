import subprocess
import time
import pygetwindow as gw
import pyautogui

def set_window_position(window_title, xpos, ypos, width, height):
    try:
        window = gw.getWindowsWithTitle(window_title)[0]
        window.moveTo(xpos, ypos)
        window.resizeTo(width, height)
    except IndexError:
        print(f"Window with title '{window_title}' not found.")

def main():
    # Define the commands to run
    commands = [
        "node process\\index.js 8080",
        "node process\\index.js 8081 8080",
        "node process\\index.js 8082 8080",
        "node process\\index.js 8083 8081",
        "node process\\index.js 8084 8080",
        "node process\\index.js 8085 8081",
        "node process\\index.js 8086 8081",
        "node process\\index.js 8087 8081",
        "node process\\index.js 8088 8081",
        "node process\\index.js 8089 8080",
        "node process\\index.js 8090 8082",
        "node process\\index.js 8091 8082",
        "node process\\index.js 8092 8081",
        "node process\\index.js 8093 8081",
        "node process\\index.js 8094 8080",
        "node process\\index.js 8095 8082",
        "node process\\index.js 8096 8082",
        "node process\\index.js 8097 8087",
        "node process\\index.js 8098 8087",
        "node process\\index.js 8099 8081"
    ]

    # Define window size and position variables
    window_width = 350
    window_height = 200
    xpos = 0
    ypos = 0
    screen_width, screen_height = pyautogui.size()

    # Start the processes and position the windows
    for command in commands:
        subprocess.Popen(["cmd", "/c", "start", "cmd", "/K", command])
        time.sleep(1)  # Wait for the window to open

        window_title = command.split()[2]  # Use port as the window title
        set_window_position(window_title, xpos, ypos, window_width, window_height)

        # Update position for next window
        xpos += window_width
        if xpos + window_width > screen_width:
            xpos = 0
            ypos += window_height

if __name__ == "__main__":
   main()