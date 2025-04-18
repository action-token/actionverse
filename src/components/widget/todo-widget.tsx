"use client"

import type React from "react"

import { useState } from "react"
import { Check, Plus, X } from "lucide-react"
import { Input } from "~/components/shadcn/ui/input"
import { Button } from "~/components/shadcn/ui/button"
import { cn } from "~/lib/utils"

interface TodoWidgetProps {
    editMode?: boolean
}

interface TodoItem {
    id: string
    text: string
    completed: boolean
}

export default function TodoWidget({ editMode }: TodoWidgetProps) {
    const [todos, setTodos] = useState<TodoItem[]>([
        { id: "1", text: "Prepare artwork for NFT drop", completed: false },
        { id: "2", text: "Schedule social media posts", completed: true },
        { id: "3", text: "Respond to collector messages", completed: false },
        { id: "4", text: "Finalize exhibition details", completed: false },
    ])
    const [newTodo, setNewTodo] = useState("")

    const addTodo = () => {
        if (!newTodo.trim()) return

        const newItem: TodoItem = {
            id: Date.now().toString(),
            text: newTodo.trim(),
            completed: false,
        }

        setTodos([...todos, newItem])
        setNewTodo("")
    }

    const toggleTodo = (id: string) => {
        setTodos(todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)))
    }

    const removeTodo = (id: string) => {
        setTodos(todos.filter((todo) => todo.id !== id))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            addTodo()
        }
    }

    return (
        <div className="h-full p-2 flex flex-col">
            <h3 className="text-sm font-medium mb-2">Tasks</h3>

            <div className="flex mb-2">
                <Input
                    className="text-xs h-8 mr-1"
                    placeholder="Add a new task..."
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <Button size="sm" className="h-8 px-2" onClick={addTodo}>
                    <Plus className="h-3 w-3" />
                </Button>
            </div>

            <div className="flex-1 overflow-auto">
                <ul className="space-y-1">
                    {todos.map((todo) => (
                        <li key={todo.id} className="flex items-center text-xs">
                            <button
                                className={cn(
                                    "w-4 h-4 border rounded-sm mr-2 flex items-center justify-center",
                                    todo.completed ? "bg-primary border-primary" : "border-input",
                                )}
                                onClick={() => toggleTodo(todo.id)}
                            >
                                {todo.completed && <Check className="h-3 w-3 text-primary-foreground" />}
                            </button>
                            <span className={cn("flex-1", todo.completed && "line-through text-muted-foreground")}>{todo.text}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                                onClick={() => removeTodo(todo.id)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
